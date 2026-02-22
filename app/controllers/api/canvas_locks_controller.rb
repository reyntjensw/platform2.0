# frozen_string_literal: true

module Api
  class CanvasLocksController < AuthenticatedController
    skip_forgery_protection

    before_action :set_environment

    # POST /api/environments/:environment_id/canvas_lock/acquire
    def acquire
      lock = CanvasLock.find_by(environment_id: @environment.id)

      if lock && lock.active?
        if lock.device_id == device_id
          # Same device — refresh the lock
          lock.update!(expires_at: lock_expiry, user_email: current_user.email, user_name: current_user.name)
          return render json: lock_json(lock)
        else
          return render json: {
            error: "Canvas is locked by another user",
            lock: lock_json(lock)
          }, status: :conflict
        end
      end

      # Expired or no lock — create/replace
      lock ||= CanvasLock.new(environment_id: @environment.id)
      lock.assign_attributes(
        device_id: device_id,
        user_email: current_user.email,
        user_name: current_user.name,
        locked_at: Time.current,
        expires_at: lock_expiry
      )
      lock.save!

      AuditLogService.record(
        action: "acquired", resource_type: "CanvasLock",
        resource_uuid: @environment.id.to_s,
        metadata: { environment: @environment.name, device_id: device_id }
      )

      render json: lock_json(lock), status: :created
    end

    # POST /api/environments/:environment_id/canvas_lock/renew
    def renew
      lock = CanvasLock.find_by(environment_id: @environment.id, device_id: device_id)

      unless lock&.active?
        return render json: { error: "You do not hold the lock on this canvas" }, status: :forbidden
      end

      lock.update!(expires_at: lock_expiry)
      AuditLogService.record(
        action: "renewed", resource_type: "CanvasLock",
        resource_uuid: @environment.id.to_s,
        metadata: { environment: @environment.name, device_id: device_id }
      )
      render json: lock_json(lock)
    end

    # GET /api/environments/:environment_id/canvas_lock/status
    def status
      lock = CanvasLock.find_by(environment_id: @environment.id)

      if lock&.active?
        render json: { locked: true, lock: lock_json(lock) }
      else
        lock&.destroy
        render json: { locked: false }
      end
    end

    # DELETE /api/environments/:environment_id/canvas_lock/release
    def release
      lock = CanvasLock.find_by(environment_id: @environment.id, device_id: device_id)

      unless lock
        return render json: { error: "You do not hold the lock on this canvas" }, status: :forbidden
      end

      lock.destroy
      AuditLogService.record(
        action: "released", resource_type: "CanvasLock",
        resource_uuid: @environment.id.to_s,
        metadata: { environment: @environment.name, device_id: device_id }
      )
      render json: { status: "ok", message: "Lock released" }
    end

    private

    def set_environment
      @environment = LocalEnvironment.find(params[:environment_id])
    rescue ActiveRecord::RecordNotFound
      render json: { error: "Environment not found" }, status: :not_found
    end

    def device_id
      params[:device_id] || request.headers["X-Device-Id"]
    end

    def lock_expiry
      60.seconds.from_now
    end

    def lock_json(lock)
      {
        environment_id: lock.environment_id,
        device_id: lock.device_id,
        user_email: lock.user_email,
        user_name: lock.user_name,
        locked_at: lock.locked_at.iso8601,
        expires_at: lock.expires_at.iso8601
      }
    end
  end
end

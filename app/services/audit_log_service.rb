# frozen_string_literal: true

# Records audit log entries for trackable actions.
# Usage:
#   AuditLogService.record(
#     action: "deployed",
#     resource_type: "Environment",
#     resource_uuid: env.uuid,
#     metadata: { version: 3 }
#   )
#
# Automatically picks up user/reseller from Current.user.
# Pass customer: to attach customer context for filtering.
class AuditLogService
  def self.record(action:, resource_type:, resource_uuid: nil, change_data: {}, metadata: {}, user: nil, customer: nil)
    u = user || Current.user
    return unless u&.uuid.present?

    enriched = metadata.merge(
      user_email: u.email,
      user_name: u.name
    ).compact

    # Attach customer context if provided
    if customer.respond_to?(:uuid)
      enriched[:customer_uuid] = customer.uuid
      enriched[:customer_name] = customer.try(:name)
    elsif u.respond_to?(:customer_uuid) && u.customer_uuid.present?
      enriched[:customer_uuid] = u.customer_uuid
    end

    AuditLog.create!(
      user_uuid: u.uuid,
      reseller_uuid: u.reseller_uuid || "unknown",
      action: action,
      resource_type: resource_type,
      resource_uuid: resource_uuid,
      change_data: change_data,
      metadata: enriched
    )
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("[AuditLog] Failed to record: #{e.message}")
  end
end

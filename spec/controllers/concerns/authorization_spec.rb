# frozen_string_literal: true

require "rails_helper"

RSpec.describe Authorization, type: :controller do
  # Anonymous controller to test the concern in isolation
  controller(ApplicationController) do
    include Authorization

    def index
      authorize!(:read, test_resource)
      head :ok
    end

    def create
      authorize!(:manage, test_resource)
      head :ok
    end

    private

    def current_user
      @current_user
    end

    def test_resource
      @test_resource
    end
  end

  let(:user) { User.new(uuid: "u-1", email: "test@example.com", customer_uuid: "c-1") }

  before do
    routes.draw do
      get "index" => "anonymous#index"
      post "create" => "anonymous#create"
    end
  end

  def set_user(roles:, **attrs)
    u = User.new(uuid: "u-1", email: "test@example.com", **attrs)
    u.roles = Array(roles)
    controller.instance_variable_set(:@current_user, u)
    u
  end

  def set_resource(resource)
    controller.instance_variable_set(:@test_resource, resource)
  end

  describe "role hierarchy" do
    it "defines roles from most to least privileged" do
      expect(Authorization::ROLE_HIERARCHY).to eq(
        %w[platform_admin reseller_admin customer_admin project_admin developer viewer]
      )
    end
  end

  describe "#authorize! with :read" do
    it "allows platform_admin to read anything" do
      set_user(roles: "platform_admin")
      set_resource(Customer.new(uuid: "c-99"))
      get :index
      expect(response).to have_http_status(:ok)
    end

    it "allows viewer to read" do
      set_user(roles: "viewer")
      set_resource(Customer.new(uuid: "c-99"))
      get :index
      expect(response).to have_http_status(:ok)
    end

    it "returns 403 when no user is present" do
      controller.instance_variable_set(:@current_user, nil)
      set_resource(Customer.new(uuid: "c-1"))
      get :index
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "#authorize! with :manage" do
    it "allows platform_admin to manage anything" do
      set_user(roles: "platform_admin")
      set_resource(Customer.new(uuid: "c-99"))
      post :create
      expect(response).to have_http_status(:ok)
    end

    it "allows reseller_admin to manage anything" do
      set_user(roles: "reseller_admin")
      set_resource(Customer.new(uuid: "c-99"))
      post :create
      expect(response).to have_http_status(:ok)
    end

    it "allows customer_admin to manage their own customer" do
      set_user(roles: "customer_admin", customer_uuid: "c-1")
      set_resource(Customer.new(uuid: "c-1"))
      post :create
      expect(response).to have_http_status(:ok)
    end

    it "denies customer_admin managing a different customer" do
      set_user(roles: "customer_admin", customer_uuid: "c-1")
      set_resource(Customer.new(uuid: "c-other"))
      post :create
      expect(response).to have_http_status(:forbidden)
    end

    it "denies viewer from managing" do
      set_user(roles: "viewer")
      set_resource(Customer.new(uuid: "c-1"))
      post :create
      expect(response).to have_http_status(:forbidden)
    end

    it "denies developer from managing" do
      set_user(roles: "developer")
      set_resource(Customer.new(uuid: "c-1"))
      post :create
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "#has_role?" do
    it "returns true when user has a role at or above the minimum" do
      set_user(roles: "reseller_admin")
      expect(controller.send(:has_role?, :customer_admin)).to be true
    end

    it "returns false when user role is below the minimum" do
      set_user(roles: "viewer")
      expect(controller.send(:has_role?, :customer_admin)).to be false
    end
  end
end

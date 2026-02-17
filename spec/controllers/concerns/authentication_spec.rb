# frozen_string_literal: true

require "rails_helper"

RSpec.describe Authentication, type: :controller do
  # Anonymous controller to test the concern in isolation
  controller(ApplicationController) do
    include Authentication

    def index
      render plain: "ok"
    end

    def protected_action
      require_authentication
      render plain: "secret"
    end
  end

  before do
    routes.draw do
      get "index" => "anonymous#index"
      get "protected_action" => "anonymous#protected_action"
    end
  end

  let(:session_data) do
    {
      user_uuid: "user-uuid-123",
      sub: "keycloak-sub-456",
      user_email: "dev@example.com",
      user_name: "Test User",
      reseller_uuid: "reseller-uuid-789",
      roles: %w[reseller_admin]
    }
  end

  describe "#current_user" do
    context "when session has user data" do
      before { session_data.each { |k, v| session[k] = v } }

      it "returns a User value object" do
        get :index
        user = controller.current_user
        expect(user).to be_a(User)
        expect(user.uuid).to eq("user-uuid-123")
        expect(user.email).to eq("dev@example.com")
        expect(user.name).to eq("Test User")
        expect(user.reseller_uuid).to eq("reseller-uuid-789")
        expect(user.roles).to eq(%w[reseller_admin])
      end
    end

    context "when session is empty" do
      it "returns nil" do
        get :index
        expect(controller.current_user).to be_nil
      end
    end
  end

  describe "#logged_in?" do
    it "returns true when user is in session" do
      session_data.each { |k, v| session[k] = v }
      get :index
      expect(controller.logged_in?).to be true
    end

    it "returns false when session is empty" do
      get :index
      expect(controller.logged_in?).to be false
    end
  end

  describe "#require_authentication" do
    context "when logged in" do
      before { session_data.each { |k, v| session[k] = v } }

      it "allows the request through" do
        get :protected_action
        expect(response.body).to eq("secret")
      end
    end

    context "when not logged in" do
      it "redirects to Keycloak" do
        get :protected_action
        expect(response).to redirect_to("/login")
      end

      it "stores the return path in session" do
        get :protected_action
        expect(session[:return_to]).to eq("/protected_action")
      end
    end
  end

  describe "Current.user" do
    it "sets Current.user from session on each request" do
      session_data.each { |k, v| session[k] = v }
      get :index
      expect(Current.user).to be_a(User)
      expect(Current.user.uuid).to eq("user-uuid-123")
    end

    it "sets Current.user to nil when not logged in" do
      get :index
      expect(Current.user).to be_nil
    end
  end
end

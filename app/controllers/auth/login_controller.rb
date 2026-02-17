# frozen_string_literal: true

module Auth
  class LoginController < ApplicationController
    layout "login"

    def show
      # If already logged in, redirect to root
      if session[:user_uuid].present?
        redirect_to root_path
        return
      end
    end
  end
end

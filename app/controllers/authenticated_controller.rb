# frozen_string_literal: true

class AuthenticatedController < ApplicationController
  include Authentication
  include Authorization

  before_action :require_authentication
end

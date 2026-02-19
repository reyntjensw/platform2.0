# frozen_string_literal: true

require "rails_helper"

RSpec.describe WidgetFilter, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:filter_type) }
    it { is_expected.to validate_presence_of(:filter_value) }
  end

  describe "associations" do
    it { is_expected.to belong_to(:widget) }
  end
end

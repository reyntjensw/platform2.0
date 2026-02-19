# frozen_string_literal: true

require "rails_helper"

RSpec.describe Widget, type: :model do
  describe "validations" do
    it { is_expected.to validate_presence_of(:chart_type) }
    it { is_expected.to validate_inclusion_of(:chart_type).in_array(Widget::CHART_TYPES) }
    it { is_expected.to validate_presence_of(:title) }
  end

  describe "associations" do
    it { is_expected.to belong_to(:dashboard) }
    it { is_expected.to have_many(:widget_filters).dependent(:destroy) }
  end
end

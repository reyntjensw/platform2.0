# frozen_string_literal: true

require "rails_helper"

RSpec.describe Dashboard, type: :model do
  describe "validations" do
    subject { build(:dashboard) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_uniqueness_of(:name).scoped_to(:local_customer_id) }
  end

  describe "associations" do
    it { is_expected.to belong_to(:local_customer) }
    it { is_expected.to have_many(:widgets).dependent(:destroy) }
  end
end

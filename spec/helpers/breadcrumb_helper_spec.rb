# frozen_string_literal: true

require "rails_helper"
require "ostruct"

RSpec.describe BreadcrumbHelper, type: :helper do
  describe "#breadcrumb_trail" do
    it "returns empty array when no context is set" do
      expect(helper.breadcrumb_trail).to eq([])
    end

    it "returns single crumb for customer context" do
      assign(:customer, OpenStruct.new(name: "Acme Corp", uuid: "c-123"))
      crumbs = helper.breadcrumb_trail
      expect(crumbs.length).to eq(1)
      expect(crumbs.first[:label]).to eq("Acme Corp")
      expect(crumbs.first[:current]).to be true
    end

    it "returns two crumbs for customer + project context" do
      assign(:customer, OpenStruct.new(name: "Acme Corp", uuid: "c-123"))
      assign(:project, OpenStruct.new(name: "Platform", uuid: "p-456"))
      crumbs = helper.breadcrumb_trail
      expect(crumbs.length).to eq(2)
      expect(crumbs.first[:label]).to eq("Acme Corp")
      expect(crumbs.first[:current]).to be false
      expect(crumbs.last[:label]).to eq("Platform")
      expect(crumbs.last[:current]).to be true
    end

    it "returns three crumbs for full hierarchy" do
      assign(:customer, OpenStruct.new(name: "Acme Corp", uuid: "c-123"))
      assign(:project, OpenStruct.new(name: "Platform", uuid: "p-456"))
      assign(:environment, OpenStruct.new(name: "production", uuid: "e-789"))
      crumbs = helper.breadcrumb_trail
      expect(crumbs.length).to eq(3)
      expect(crumbs.map { |c| c[:label] }).to eq(["Acme Corp", "Platform", "production"])
      expect(crumbs.last[:current]).to be true
      expect(crumbs.first(2).all? { |c| c[:current] == false }).to be true
    end

    it "falls back to '#' when routes are not defined" do
      assign(:customer, OpenStruct.new(name: "Acme", uuid: "c-1"))
      crumbs = helper.breadcrumb_trail
      expect(crumbs.first[:path]).to eq("#")
    end
  end
end

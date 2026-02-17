# frozen_string_literal: true

require "rails_helper"
require "ostruct"

RSpec.describe SidebarHelper, type: :helper do
  describe "#sidebar_item" do
    it "renders a link with icon and label" do
      html = helper.sidebar_item(label: "Canvas", icon: "🎨", path: "/canvas")
      expect(html).to include("🎨")
      expect(html).to include("Canvas")
      expect(html).to include('href="/canvas"')
    end

    it "adds active class when active" do
      html = helper.sidebar_item(label: "Canvas", icon: "🎨", path: "/canvas", active: true)
      expect(html).to include("active")
      expect(html).to include('aria-current="page"')
    end

    it "renders badge when provided" do
      html = helper.sidebar_item(label: "FinOps", icon: "💰", path: "#", badge: "3", badge_type: "warn")
      expect(html).to include("sidebar-badge")
      expect(html).to include("warn")
      expect(html).to include("3")
    end
  end

  describe "#sidebar_app_items" do
    it "returns six workspace navigation items" do
      expect(helper.sidebar_app_items.length).to eq(6)
    end

    it "includes Canvas, FinOps, Security, Docs, Deploy, Drift" do
      labels = helper.sidebar_app_items.map { |i| i[:label] }
      expect(labels).to eq(["Canvas", "FinOps", "Security", "Documentation", "Deployments", "Drift Detection"])
    end
  end

  describe "#sidebar_group_items" do
    it "includes group items and separators" do
      items = helper.sidebar_group_items
      groups = items.reject { |i| i[:separator] }
      expect(groups.map { |i| i[:short_label] }).to include("All", "Comp", "Data", "Net", "Store", "Sec")
    end
  end

  describe "#workspace_visible?" do
    it "returns false when @environment is not set" do
      expect(helper.workspace_visible?).to be false
    end

    it "returns true when @environment is set" do
      assign(:environment, OpenStruct.new(name: "dev"))
      expect(helper.workspace_visible?).to be true
    end
  end
end

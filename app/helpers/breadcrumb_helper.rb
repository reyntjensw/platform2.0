# frozen_string_literal: true

module BreadcrumbHelper
  # Builds an array of breadcrumb hashes from controller context.
  # Each hash has :label, :path, and :current (boolean).
  #
  # The trail is built dynamically based on which instance variables
  # are set by the current controller (@customer, @project, @environment).
  #
  # Navigation hierarchy: Customers → Customer (show) → Project (show) → Environment
  #
  # Returns an empty array if no context is available.
  def breadcrumb_trail
    crumbs = []

    # Customer level — links back to the customer list
    if defined?(@customer) && @customer.present?
      crumbs << {
        label: @customer.try(:name) || "Customer",
        path: safe_path(:customers_path),
        current: false
      }
    end

    # Project level — links to the customer show page (which lists projects)
    if defined?(@project) && @project.present? && defined?(@customer) && @customer.present?
      crumbs << {
        label: @project.try(:name) || "Project",
        path: safe_path(:customer_path, id_for(@customer)),
        current: false
      }
    end

    # Environment level — links to the project show page (which lists environments)
    if defined?(@environment) && @environment.present? && defined?(@project) && @project.present? && defined?(@customer) && @customer.present?
      crumbs << {
        label: @environment.try(:name) || "Environment",
        path: safe_path(:customer_project_path, id_for(@customer), id_for(@project)),
        current: false
      }
    end

    # Mark the last crumb as current (non-clickable)
    crumbs.last[:current] = true if crumbs.any?

    crumbs
  end

  private

  # Extract the UUID or id param from a value object or model.
  def id_for(record)
    record.try(:uuid) || record.try(:to_param) || record
  end

  # Safely resolve a named route, falling back to "#" if the route isn't defined.
  def safe_path(route_name, *args)
    if respond_to?(route_name)
      public_send(route_name, *args)
    else
      "#"
    end
  end
end

# frozen_string_literal: true

module SidebarHelper
  # Primary navigation items (shown inline in topnav).
  def sidebar_app_items
    items = []

    items << {
      icon: "🏠", label: "Home", short_label: "Home",
      path: root_path,
      active: controller_name == "resellers"
    }

    if current_user&.platform_admin? || current_user&.reseller_admin?
      items << {
        icon: "👥", label: "Customers", short_label: "Cust",
        path: customers_path,
        active: controller_name == "customers" && action_name == "index"
      }
    end

    if current_user&.platform_admin?
      items << {
        icon: "📦", label: "Modules", short_label: "Mod",
        path: modules_path,
        active: controller_name.in?(%w[module_definitions module_imports module_updates])
      }

      items << {
        icon: "🚀", label: "Runners", short_label: "Run",
        path: runners_path,
        active: controller_name == "runners"
      }
    end

    items
  end

  # Config/admin items (shown in the Config dropdown in topnav).
  def topnav_config_items
    items = []

    if current_user&.platform_admin?
      items << {
        icon: "git_credentials", label: "Git Credentials",
        path: git_credentials_path,
        active: controller_name == "git_credentials"
      }
    end

    items << {
      icon: "global_tags", label: "Global Tags",
      path: global_tags_path,
      active: controller_name == "global_tags"
    }

    items << {
      icon: "users", label: "Users",
      path: keycloak_users_path,
      active: controller_name == "keycloak_users"
    }

    items
  end

  # Project-level section navigation — shown when inside a project.
  def sidebar_project_sections
    return [] unless defined?(@project) && @project.present? && defined?(@customer) && @customer.present?

    base_path = customer_project_path(@customer.uuid, @project.uuid)
    current_tab = params[:tab].to_s
    provider = @project.provider&.downcase

    sections = []

    # Cloud section
    sections << { type: :heading, label: "Cloud" }

    sections << {
      icon: "🌍", label: "Environments",
      path: base_path,
      active: current_tab.blank? || current_tab == "environments"
    }

    if provider == "aws"
      sections << {
        icon: "🔑", label: "AWS Credentials",
        path: "#{base_path}?tab=aws_credentials",
        active: current_tab == "aws_credentials"
      }
    end

    if provider == "azure"
      sections << {
        icon: "🔑", label: "Azure Credentials",
        path: "#{base_path}?tab=credentials",
        active: current_tab == "credentials"
      }
    end

    # Platform section
    sections << { type: :heading, label: "Platform" }

    sections << {
      icon: "🔌", label: "Integrations",
      path: "#{base_path}?tab=integrations",
      active: current_tab == "integrations"
    }

    # Settings section
    sections << { type: :heading, label: "Settings" }

    sections << {
      icon: "⚙️", label: "General",
      path: "#{base_path}?tab=general",
      active: current_tab == "general"
    }

    sections
  end
end

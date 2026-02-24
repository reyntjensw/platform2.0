Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Authentication
  get  "/login",                  to: "auth/login#show", as: :login
  get  "/auth/keycloak/callback", to: "auth/sessions#create"
  get  "/auth/failure",           to: "auth/sessions#failure"
  get  "/auth/logout",            to: "auth/sessions#destroy"

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # React mounting test page
  get "react_test" => "pages#react_test"

  # Audit Log
  resources :audit_logs, only: [:index]

  # Pipeline Runner Admin
  resources :runners, only: [:index]

  # Module Registry
  resources :modules, only: [:index, :show, :edit, :update, :destroy], controller: "module_definitions" do
    member do
      post :deprecate
      post :rescan
    end
    # Module Updates / Version Management
    resources :updates, controller: "module_updates", only: [:index] do
      collection do
        post :check_updates
        post :upgrade_all
      end
      member do
        post :upgrade_resource
      end
    end
  end

  # Module Import Wizard
  resources :module_imports, path: "modules/import", only: [:new] do
    member do
      get "step/:step", action: :step, as: :step
      patch :save_source
      patch :save_auth
      post :run_scan
      patch :save_classifications
      patch :save_field_configs
      post :finalize
      post :verify_credential
      post :create_credential
      get :registry_versions
    end
  end

  # Git Credentials Management
  resources :git_credentials, path: "settings/git_credentials", except: [:show, :edit, :new] do
    member do
      post :verify
      patch :rotate
    end
  end

  # Global Tags Management
  resources :global_tags, path: "settings/global_tags", only: [:index, :create, :update, :destroy] do
    member do
      patch :toggle
    end
  end

  # Canvas API
  namespace :api do
    resources :environments, param: :id, only: [] do
      resources :resources, only: [:index, :create, :update, :destroy] do
        member do
          get :properties
          post :upgrade
        end
      end
      resources :connections, only: [:create, :destroy]
      resources :business_rules, only: [:index, :update, :create, :destroy]
      resources :application_groups, only: [:index, :create, :update, :destroy]

      # Custom code (single record per environment)
      get    "custom_code", to: "custom_codes#show"
      put    "custom_code", to: "custom_codes#update"

      # Canvas validation (combined pre-deploy + field checks)
      get    "canvas_validations", to: "canvas_validations#show"

      # Deployments (approval gate)
      resources :deployments, only: [:show, :create] do
        collection do
          get :pre_checks
          get :runner_status
        end
        member do
          patch :approve
          patch :reject
          get :logs
          get :plan
          get :infracost
        end
      end

      # Canvas locking
      post   "canvas_lock/acquire", to: "canvas_locks#acquire"
      post   "canvas_lock/renew",   to: "canvas_locks#renew"
      get    "canvas_lock/status",  to: "canvas_locks#status"
      delete "canvas_lock/release", to: "canvas_locks#release"
    end

    # Promotions API (project-scoped)
    resources :projects, param: :id, only: [] do
      get  "promotions/pipeline", to: "promotions#pipeline"
      get  "promotions/diff",     to: "promotions#diff"
      post "promotions/preview",  to: "promotions#preview"
      post "promotions",          to: "promotions#create", as: :promotions
      get  "promotions/history",  to: "promotions#history"
      resources :promotions, only: [] do
        member do
          patch :approve
          patch :reject
        end
      end
    end

    # Pipeline callback (service token auth, not Keycloak)
    namespace :callbacks do
      resources :deployments, only: [:update] do
        resources :layers, only: [:update], controller: "layer_callbacks"
      end
    end

    # Global Tags API
    resources :global_tags, only: [:index, :create, :update, :destroy] do
      collection do
        get :merged
        get :by_level
      end
      member do
        patch :toggle
      end
    end
  end

  # Canvas view (standalone, not nested under customer/project)
  get "canvas/:id", to: "canvas#show", as: :canvas

  # User Management
  resources :keycloak_users, path: "users", only: [:index, :new, :create, :edit, :update, :destroy] do
    collection do
      get :customers_for_reseller
    end
  end

  # Tenant hierarchy
  root "resellers#index"

  resources :resellers, param: :uuid, only: :index
  resources :customers, param: :uuid, only: %i[index show] do
    resources :projects, param: :uuid do
      collection do
        get :regions
      end
      resources :environments, param: :uuid, only: [:create, :update] do
        collection do
          post :validate
        end
      end
      resources :canvas_environments, only: [:create, :destroy] do
        member do
          patch :link
          patch :unlink
        end
      end
      resources :azure_credentials, param: :id, only: %i[index create update destroy] do
        collection do
          post :test
          post :expiring
        end
      end
    end

    # Financial Dashboard HTML view
    resources :dashboards, controller: "dashboards", only: [:index]

    # Savings / Cost Optimization
    get "savings", to: "savings#index", as: :savings

    # Rightsizing
    get "rightsizing", to: "rightsizing#index", as: :rightsizing

    # Security Dashboard (environment-scoped)
    get "security/:environment_uuid", to: "security#show", as: :security_dashboard

    # Inventory Dashboard (environment-scoped)
    get "inventory/:environment_uuid", to: "inventory#show", as: :inventory_dashboard

    # Financial Dashboard API
    namespace :api, module: "api/customer" do
      resources :dashboards, only: [:index, :show, :create, :update, :destroy] do
        member do
          patch :reorder
        end
        resources :widgets, only: [:create, :update, :destroy]
      end

      # Cost proxy endpoints
      post   "cost/daily_spend",                to: "cost#daily_spend"
      post   "cost/service_spend",              to: "cost#service_spend"
      post   "cost/storage_spend",              to: "cost#storage_spend"
      post   "cost/monthly_spend_trend",        to: "cost#monthly_spend_trend"
      post   "cost/account_spend_distribution", to: "cost#account_spend_distribution"
      post   "cost/top_services",               to: "cost#top_services"
      get    "cost/accounts",                   to: "cost#accounts"
      get    "cost/services",                   to: "cost#services"

      # Savings proxy endpoints
      post   "savings/commitments",             to: "savings#commitments"
      post   "savings/commitment-plans",        to: "savings#commitment_plans"
      post   "savings/metrics",                 to: "savings#metrics"
      get    "savings/plan/:plan_uuid",         to: "savings#plan"
      post   "savings/apply_plan",              to: "savings#apply_plan"

      # Documentation proxy endpoints
      post   "documentation/generate",          to: "documentation#generate"
      get    "documentation/status/:task_id",   to: "documentation#status"
      get    "documentation/aws/:account_id",   to: "documentation#aws_doc"

      # Inventory proxy endpoints
      post   "inventory/resources",             to: "inventory#resources"
    end
  end
end

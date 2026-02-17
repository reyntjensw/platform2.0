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

  # Canvas API
  namespace :api do
    resources :environments, param: :id, only: [] do
      resources :resources, only: [:index, :create, :update, :destroy] do
        member do
          get :properties
        end
      end
      resources :connections, only: [:create, :destroy]
      resources :business_rules, only: [:index, :update, :create, :destroy]
      resources :application_groups, only: [:index, :create, :update, :destroy]
    end

    # Pipeline callback (service token auth, not Keycloak)
    namespace :callbacks do
      resources :deployments, only: [:update]
    end
  end

  # Canvas view (standalone, not nested under customer/project)
  get "canvas/:id", to: "canvas#show", as: :canvas

  # Tenant hierarchy
  root "resellers#index"

  resources :resellers, param: :uuid, only: :index
  resources :customers, param: :uuid, only: %i[index show] do
    resources :projects, param: :uuid do
      collection do
        get :regions
      end
      resources :environments, param: :uuid, only: [:create] do
        collection do
          post :validate
        end
      end
      resources :azure_credentials, param: :id, only: %i[index create update destroy] do
        collection do
          post :test
          post :expiring
        end
      end
    end
  end
end

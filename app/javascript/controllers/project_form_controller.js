import { Controller } from "@hotwired/stimulus"

// Handles the New Project form:
// - When provider changes, fetches regions from the API and populates the region select
//
// Usage:
//   <form data-controller="project-form" data-project-form-regions-url-value="/customers/:uuid/projects/regions">
//     <select data-project-form-target="provider" data-action="change->project-form#providerChanged">
//     <select data-project-form-target="region">
//   </form>
export default class extends Controller {
    static targets = ["provider", "region"]
    static values = { regionsUrl: String }

    connect() {
        // If provider already has a value (e.g. validation error re-render), load regions
        if (this.providerTarget.value) {
            this.loadRegions(this.providerTarget.value)
        }
    }

    providerChanged() {
        const provider = this.providerTarget.value
        this.regionTarget.innerHTML = '<option value="">Loading...</option>'
        this.regionTarget.disabled = true

        if (!provider) {
            this.regionTarget.innerHTML = '<option value="">Select a provider first</option>'
            return
        }

        this.loadRegions(provider)
    }

    async loadRegions(provider) {
        try {
            const url = `${this.regionsUrlValue}?cloud_provider=${encodeURIComponent(provider)}`
            const response = await fetch(url, {
                headers: { "Accept": "application/json" }
            })
            const regions = await response.json()

            this.regionTarget.innerHTML = '<option value="">Select a region...</option>'
            regions.forEach(region => {
                const option = document.createElement("option")
                option.value = region.region_code
                option.textContent = `${region.display_name} (${region.region_code})`
                this.regionTarget.appendChild(option)
            })
            this.regionTarget.disabled = false
        } catch (e) {
            this.regionTarget.innerHTML = '<option value="">Failed to load regions</option>'
            this.regionTarget.disabled = true
        }
    }
}

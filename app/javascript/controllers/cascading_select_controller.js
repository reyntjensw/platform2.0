import { Controller } from "@hotwired/stimulus"

// Cascading select: when the parent dropdown changes, fetch child options from the server.
//
// Usage:
//   <form data-controller="cascading-select"
//         data-cascading-select-url-value="/users/customers_for_reseller">
//     <select data-cascading-select-target="parent" data-action="change->cascading-select#parentChanged">
//     <select data-cascading-select-target="child">
//   </form>
export default class extends Controller {
    static targets = ["parent", "child"]
    static values = { url: String }

    connect() {
        if (this.hasParentTarget && this.parentTarget.value) {
            this.loadChildren(this.parentTarget.value)
        }
    }

    parentChanged() {
        const parentValue = this.parentTarget.value
        this.childTarget.innerHTML = '<option value="">Loading...</option>'
        this.childTarget.disabled = true

        if (!parentValue) {
            this.childTarget.innerHTML = '<option value="">Select a reseller first...</option>'
            this.childTarget.disabled = false
            return
        }

        this.loadChildren(parentValue)
    }

    async loadChildren(parentValue) {
        try {
            const url = `${this.urlValue}?reseller_uuid=${encodeURIComponent(parentValue)}`
            const response = await fetch(url, {
                headers: { "Accept": "application/json" }
            })
            const items = await response.json()

            this.childTarget.innerHTML = '<option value="">Select a customer...</option>'
            items.forEach(item => {
                const option = document.createElement("option")
                option.value = item.uuid
                option.textContent = item.name
                this.childTarget.appendChild(option)
            })
            this.childTarget.disabled = false
        } catch (e) {
            this.childTarget.innerHTML = '<option value="">Failed to load customers</option>'
            this.childTarget.disabled = false
        }
    }
}

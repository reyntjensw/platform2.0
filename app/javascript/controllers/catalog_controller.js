import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["panel", "searchInput", "category"]

    toggleCategory(e) {
        const category = e.target.closest(".catalog-category")
        const items = category.querySelector(".catalog-category__items")
        const expanded = e.target.getAttribute("aria-expanded") === "true"
        e.target.setAttribute("aria-expanded", !expanded)
        items.hidden = expanded
    }

    search() {
        const query = this.searchInputTarget.value.toLowerCase().trim()
        this.panelTarget.querySelectorAll(".catalog-item").forEach(item => {
            const name = (item.dataset.name || "").toLowerCase()
            item.hidden = query && !name.includes(query)
        })

        // Hide empty categories
        this.categoryTargets.forEach(cat => {
            const visible = cat.querySelectorAll(".catalog-item:not([hidden])").length
            cat.hidden = visible === 0
        })
    }

    async addModule(e) {
        const moduleId = e.params.moduleId
        const canvasCtrl = this.application.getControllerForElementAndIdentifier(
            this.element.closest("[data-controller~='canvas']"), "canvas"
        )
        if (!canvasCtrl) return

        const resp = await fetch(canvasCtrl.apiUrlValue, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
            },
            body: JSON.stringify({ module_definition_id: moduleId })
        })

        if (resp.ok) {
            const resource = await resp.json()
            canvasCtrl.addResource(resource)
        }
    }
}

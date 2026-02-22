import { Controller } from "@hotwired/stimulus"

// Client-side search + filter for entity card grids (resellers, customers).
// Searches data-name on each card, filters by data-status via pills.
export default class extends Controller {
    static targets = ["searchInput", "grid", "pill"]

    connect() {
        this.currentFilter = "all"
    }

    search() {
        this._apply()
    }

    filter(event) {
        const value = (event.currentTarget.dataset.filter || "all").toLowerCase()
        this.currentFilter = value

        // Toggle active pill
        this.pillTargets.forEach(pill => {
            pill.classList.toggle("active", (pill.dataset.filter || "all").toLowerCase() === value)
        })

        this._apply()
    }

    _apply() {
        const query = this.searchInputTarget.value.toLowerCase().trim()
        const cards = this.gridTarget.querySelectorAll("[data-name]")

        cards.forEach(card => {
            const name = (card.dataset.name || "").toLowerCase()
            const status = (card.dataset.status || "").toLowerCase()

            const matchesSearch = !query || name.includes(query)
            const matchesFilter = this.currentFilter === "all" || status === this.currentFilter

            card.style.display = (matchesSearch && matchesFilter) ? "" : "none"
        })
    }
}

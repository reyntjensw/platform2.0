import { Controller } from "@hotwired/stimulus"

// Client-side search + provider filter for the project card grid.
export default class extends Controller {
    static targets = ["search", "grid", "card", "empty", "count", "pill"]

    connect() {
        this.currentProvider = "all"
        this._apply()
    }

    filter() {
        this._apply()
    }

    filterByProvider(event) {
        const value = (event.currentTarget.dataset.filter || "all").toLowerCase()
        this.currentProvider = value

        this.pillTargets.forEach(pill => {
            pill.classList.toggle("active", (pill.dataset.filter || "all").toLowerCase() === value)
        })

        this._apply()
    }

    _apply() {
        const query = (this.searchTarget.value || "").toLowerCase()
        let visible = 0

        this.cardTargets.forEach(card => {
            const name = (card.dataset.name || "").toLowerCase()
            const provider = (card.dataset.provider || "").toLowerCase()

            const matchesSearch = !query || name.includes(query) || provider.includes(query)
            const matchesProvider = this.currentProvider === "all" || provider === this.currentProvider

            const show = matchesSearch && matchesProvider
            card.style.display = show ? "" : "none"
            if (show) visible++
        })

        this.emptyTarget.style.display = visible === 0 ? "block" : "none"
        this.gridTarget.style.display = visible === 0 ? "none" : ""
        if (this.hasCountTarget) this.countTarget.textContent = visible
    }
}

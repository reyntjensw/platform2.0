import { Controller } from "@hotwired/stimulus"

// Client-side search + sort for the project card grid.
export default class extends Controller {
    static targets = ["search", "sort", "grid", "card", "empty", "count"]

    connect() {
        this.filter()
    }

    filter() {
        const query = (this.searchTarget.value || "").toLowerCase()
        let visible = 0

        this.cardTargets.forEach(card => {
            const name = (card.dataset.name || "").toLowerCase()
            const provider = (card.dataset.provider || "").toLowerCase()
            const match = name.includes(query) || provider.includes(query)
            card.style.display = match ? "" : "none"
            if (match) visible++
        })

        this.emptyTarget.style.display = visible === 0 ? "block" : "none"
        this.gridTarget.style.display = visible === 0 ? "none" : ""
        if (this.hasCountTarget) this.countTarget.textContent = visible
    }

    sort() {
        const key = this.sortTarget.value
        const cards = [...this.cardTargets]

        cards.sort((a, b) => {
            const av = (a.dataset[key] || "").toLowerCase()
            const bv = (b.dataset[key] || "").toLowerCase()
            return av.localeCompare(bv)
        })

        cards.forEach(c => this.gridTarget.appendChild(c))
    }
}

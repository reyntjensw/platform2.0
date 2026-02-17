import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["grid", "searchInput", "categorySelect", "pills", "providerSelect"]

    setProvider(event) {
        // Support both button (params) and select (target value)
        const provider = event.params?.provider ?? event.target.value ?? ""
        const url = new URL(window.location)

        if (provider) {
            url.searchParams.set("cloud_provider", provider)
        } else {
            url.searchParams.delete("cloud_provider")
        }
        url.searchParams.delete("category")
        window.location = url
    }

    setCategory(event) {
        const category = event.target.value
        const url = new URL(window.location)

        if (category) {
            url.searchParams.set("category", category)
        } else {
            url.searchParams.delete("category")
        }
        window.location = url
    }

    search() {
        const query = this.searchInputTarget.value.toLowerCase().trim()
        // Support both card grid and table row layouts
        const items = this.gridTarget.querySelectorAll(".module-card, .module-table__row, .mod-tbl__row")

        items.forEach(item => {
            const name = (item.dataset.name || "").toLowerCase()
            const category = (item.dataset.category || "").toLowerCase()
            const match = !query || name.includes(query) || category.includes(query)
            item.style.display = match ? "" : "none"
        })
    }
}

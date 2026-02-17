import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["scroll", "sectionProps", "sectionValid", "sectionXrefs"]

    scrollTo(e) {
        const section = e.params.section
        // Update tab active state
        this.element.querySelectorAll(".rp-tab").forEach(t => {
            t.classList.toggle("active", t.dataset.rpanelSectionParam === section)
        })
        // Scroll to section
        const el = document.getElementById(`rp-section-${section}`)
        if (el && this.hasScrollTarget) {
            el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }

    // Legacy support for switchTab calls from canvas-main
    switchTab(e) {
        const tab = e.params?.tab
        if (tab) {
            this.scrollTo({ params: { section: tab } })
        }
    }
}

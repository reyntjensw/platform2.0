import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["bar", "groups"]

    switchApp(e) {
        const app = e.params.app
        // Update active state on app nav buttons
        this.element.querySelectorAll(".gb-app").forEach(b => {
            b.classList.toggle("active", b.dataset.sidebarNavAppParam === app)
        })
        // Show/hide canvas groups section
        if (this.hasGroupsTarget) {
            this.groupsTarget.style.display = app === "canvas" ? "" : "none"
        }
    }
}

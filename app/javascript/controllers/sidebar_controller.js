import { Controller } from "@hotwired/stimulus"

// Collapse/expand sidebar with localStorage persistence.
// Sidebar is 56px collapsed, 200px expanded (via CSS `.sidebar.expanded`).
//
// Usage:
//   <aside class="sidebar" data-controller="sidebar" data-sidebar-target="sidebar">
//     ...
//   </aside>
export default class extends Controller {
    static targets = ["sidebar"]

    connect() {
        const stored = localStorage.getItem("sidebar_expanded")
        if (stored === "true") {
            this.expand()
        } else {
            this.collapse()
        }
    }

    toggle() {
        if (this.sidebarTarget.classList.contains("expanded")) {
            this.collapse()
        } else {
            this.expand()
        }
    }

    expand() {
        this.sidebarTarget.classList.add("expanded")
        localStorage.setItem("sidebar_expanded", "true")
    }

    collapse() {
        this.sidebarTarget.classList.remove("expanded")
        localStorage.setItem("sidebar_expanded", "false")
    }

    pin() {
        this.expand()
    }
}

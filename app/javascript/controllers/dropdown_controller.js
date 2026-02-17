import { Controller } from "@hotwired/stimulus"

// Toggles a dropdown menu open/closed.
// Closes on outside click or Escape key.
//
// Usage:
//   <div data-controller="dropdown">
//     <button data-action="click->dropdown#toggle" data-dropdown-target="trigger">Menu</button>
//     <div data-dropdown-target="menu" class="user-dropdown-menu">...</div>
//   </div>
export default class extends Controller {
    static targets = ["menu", "trigger"]

    connect() {
        this.close = this.close.bind(this)
        this.handleKeydown = this.handleKeydown.bind(this)
    }

    toggle(event) {
        event.stopPropagation()
        if (this.menuTarget.classList.contains("open")) {
            this.hide()
        } else {
            this.show()
        }
    }

    show() {
        this.menuTarget.classList.add("open")
        if (this.hasTriggerTarget) {
            this.triggerTarget.setAttribute("aria-expanded", "true")
        }
        document.addEventListener("click", this.close)
        document.addEventListener("keydown", this.handleKeydown)
    }

    hide() {
        this.menuTarget.classList.remove("open")
        if (this.hasTriggerTarget) {
            this.triggerTarget.setAttribute("aria-expanded", "false")
        }
        document.removeEventListener("click", this.close)
        document.removeEventListener("keydown", this.handleKeydown)
    }

    close(event) {
        if (!this.element.contains(event.target)) {
            this.hide()
        }
    }

    handleKeydown(event) {
        if (event.key === "Escape") {
            this.hide()
            if (this.hasTriggerTarget) {
                this.triggerTarget.focus()
            }
        }
    }

    disconnect() {
        document.removeEventListener("click", this.close)
        document.removeEventListener("keydown", this.handleKeydown)
    }
}

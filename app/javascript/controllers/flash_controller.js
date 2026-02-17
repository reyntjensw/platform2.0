import { Controller } from "@hotwired/stimulus"

// Auto-dismiss flash messages after a configurable delay (default 5s).
// Adds a fade-out CSS class before removing the element.
//
// Usage:
//   <div class="flash flash-success"
//        data-controller="flash"
//        data-flash-auto-dismiss-value="5000">
//     <span class="flash-message">Saved!</span>
//     <button data-action="flash#dismiss">&times;</button>
//   </div>
export default class extends Controller {
    static values = {
        autoDismiss: { type: Number, default: 5000 }
    }

    connect() {
        if (this.autoDismissValue > 0) {
            this.timeout = setTimeout(() => this.dismiss(), this.autoDismissValue)
        }
    }

    dismiss() {
        clearTimeout(this.timeout)
        this.element.style.opacity = "0"
        this.element.style.transform = "translateY(-10px)"
        this.element.style.transition = "opacity 0.3s ease, transform 0.3s ease"

        setTimeout(() => this.element.remove(), 300)
    }

    disconnect() {
        clearTimeout(this.timeout)
    }
}

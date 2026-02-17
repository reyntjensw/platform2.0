import { Controller } from "@hotwired/stimulus"

// Generic modal controller.
// Usage:
//   <div data-controller="modal">
//     <button data-action="click->modal#open">Open</button>
//     <div data-modal-target="overlay" class="modal-overlay">
//       <div class="modal-panel">
//         <button data-action="click->modal#close">×</button>
//       </div>
//     </div>
//   </div>
export default class extends Controller {
    static targets = ["overlay"]

    open() {
        this.overlayTarget.classList.add("open")
        document.body.style.overflow = "hidden"
    }

    close() {
        this.overlayTarget.classList.remove("open")
        document.body.style.overflow = ""
    }

    // Close on backdrop click
    backdropClose(event) {
        if (event.target === this.overlayTarget) {
            this.close()
        }
    }

    // Close on Escape
    closeOnEscape(event) {
        if (event.key === "Escape") {
            this.close()
        }
    }
}

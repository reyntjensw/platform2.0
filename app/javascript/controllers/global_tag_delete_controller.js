import { Controller } from "@hotwired/stimulus"

// Delete + Edit modals for Global Tags.
// One controller wraps both modals; each row button passes data attrs.
export default class extends Controller {
    static targets = [
        "deleteOverlay", "deleteTagName", "deleteForm",
        "editOverlay", "editForm", "editKey", "editValue", "editDescription"
    ]

    // ── Delete ──

    openDelete(event) {
        const btn = event.currentTarget
        this.deleteTagNameTarget.textContent = btn.dataset.tagKey || "this tag"
        this.deleteFormTarget.action = btn.dataset.deleteUrl
        this.deleteOverlayTarget.classList.add("open")
        document.body.style.overflow = "hidden"
    }

    closeDelete() {
        this.deleteOverlayTarget.classList.remove("open")
        document.body.style.overflow = ""
    }

    backdropCloseDelete(event) {
        if (event.target === this.deleteOverlayTarget) this.closeDelete()
    }

    // ── Edit ──

    openEdit(event) {
        const btn = event.currentTarget
        this.editFormTarget.action = btn.dataset.editUrl
        this.editKeyTarget.value = btn.dataset.tagKey || ""
        this.editValueTarget.value = btn.dataset.tagValue || ""
        this.editDescriptionTarget.value = btn.dataset.tagDescription || ""
        this.editOverlayTarget.classList.add("open")
        document.body.style.overflow = "hidden"
    }

    closeEdit() {
        this.editOverlayTarget.classList.remove("open")
        document.body.style.overflow = ""
    }

    backdropCloseEdit(event) {
        if (event.target === this.editOverlayTarget) this.closeEdit()
    }

    // ── Shared ──

    closeOnEscape(event) {
        if (event.key === "Escape") {
            this.closeDelete()
            this.closeEdit()
        }
    }
}

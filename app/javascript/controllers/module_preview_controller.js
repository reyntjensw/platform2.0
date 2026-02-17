import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["displayName", "icon", "previewIcon", "previewName", "previewDesc"]

    update() {
        if (this.hasPreviewNameTarget && this.hasDisplayNameTarget) {
            this.previewNameTarget.textContent = this.displayNameTarget.value || "Module Name"
        }
        if (this.hasPreviewIconTarget && this.hasIconTarget) {
            this.previewIconTarget.textContent = this.iconTarget.value || "MOD"
        }
    }
}

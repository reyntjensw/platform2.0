import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["displayName", "description", "icon", "previewIcon", "previewName", "previewDesc"]

    update() {
        if (this.hasPreviewNameTarget && this.hasDisplayNameTarget) {
            this.previewNameTarget.textContent = this.displayNameTarget.value || "Module Name"
        }
        if (this.hasPreviewDescTarget && this.hasDescriptionTarget) {
            this.previewDescTarget.textContent = this.descriptionTarget.value || "Module description"
        }
        if (this.hasPreviewIconTarget && this.hasIconTarget) {
            this.previewIconTarget.textContent = this.iconTarget.value || "MOD"
        }
    }
}

import { Controller } from "@hotwired/stimulus"
import { csrf } from "../components/canvas/constants"

export default class extends Controller {
    static targets = ["name", "credType", "token", "result"]
    static values = { url: String }

    async verifyAndSave() {
        const body = {
            name: this.nameTarget.value,
            host: this._extractHost(),
            credential_type: this.credTypeTarget.value,
            token: this.tokenTarget.value,
            scope: "read_repository"
        }

        this.resultTarget.innerHTML = '<span class="loading">Verifying...</span>'

        try {
            const resp = await fetch(this.urlValue, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf() },
                body: JSON.stringify(body)
            })
            const data = await resp.json()

            if (data.verified) {
                this.resultTarget.innerHTML = `<span class="text-success">✓ ${data.message}</span>`
                // Reload page to show the new credential in the list
                setTimeout(() => window.location.reload(), 1000)
            } else if (data.error) {
                this.resultTarget.innerHTML = `<span class="text-danger">✗ ${data.error}</span>`
            } else {
                this.resultTarget.innerHTML = `<span class="text-warning">${data.message}</span>`
            }
        } catch (e) {
            this.resultTarget.innerHTML = `<span class="text-danger">✗ Request failed</span>`
        }
    }

    _extractHost() {
        // Try to extract host from the source URL input on the page
        const urlInput = document.getElementById("source_url")
        if (urlInput && urlInput.value) {
            try {
                return new URL(urlInput.value).host
            } catch { /* ignore */ }
        }
        return ""
    }
}

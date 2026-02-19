import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["panel", "empty", "content", "frame", "form"]

    connect() {
        // Listen for canvas selection events
        this.element.addEventListener("canvas:selected", (e) => this.load(e.detail.resourceId))
        this.element.addEventListener("canvas:deselected", () => this.clear())
    }

    async load(resourceId) {
        this.emptyTarget.hidden = true
        this.contentTarget.hidden = false

        const canvasCtrl = this.application.getControllerForElementAndIdentifier(
            this.element.closest("[data-controller~='canvas']"), "canvas"
        )
        if (!canvasCtrl) return

        const url = `${canvasCtrl.apiUrlValue}/${resourceId}/properties`
        const resp = await fetch(url, { headers: { "Accept": "text/html" } })
        if (resp.ok) {
            const html = await resp.text()
            this.frameTarget.textContent = ""
            const doc = new DOMParser().parseFromString(html, "text/html")
            while (doc.body.firstChild) {
                this.frameTarget.appendChild(doc.body.firstChild)
            }
        }
    }

    clear() {
        this.emptyTarget.hidden = false
        this.contentTarget.hidden = true
        this.frameTarget.innerHTML = ""
    }

    async save(e) {
        e.preventDefault()
        const form = e.target
        const resourceId = form.dataset.resourceId
        const formData = new FormData(form)
        const config = {}

        for (const [key, value] of formData.entries()) {
            const match = key.match(/^config\[(.+)\]$/)
            if (match) {
                // Convert types
                let v = value
                if (v === "true") v = true
                else if (v === "false") v = false
                else if (/^\d+$/.test(v)) v = parseInt(v, 10)
                config[match[1]] = v
            }
        }

        const canvasCtrl = this.application.getControllerForElementAndIdentifier(
            this.element.closest("[data-controller~='canvas']"), "canvas"
        )
        if (!canvasCtrl) return

        const resp = await fetch(`${canvasCtrl.apiUrlValue}/${resourceId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
            },
            body: JSON.stringify({ config })
        })

        if (resp.ok) {
            // Reload properties to show validation state
            this.load(resourceId)
        }
    }

    async delete(e) {
        const resourceId = e.target.dataset.resourceId || e.params.resourceId
        if (!confirm("Delete this resource?")) return

        const canvasCtrl = this.application.getControllerForElementAndIdentifier(
            this.element.closest("[data-controller~='canvas']"), "canvas"
        )
        if (!canvasCtrl) return

        const resp = await fetch(`${canvasCtrl.apiUrlValue}/${resourceId}`, {
            method: "DELETE",
            headers: { "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" }
        })

        if (resp.ok) {
            canvasCtrl.removeResource(resourceId)
            this.clear()
        }
    }
}

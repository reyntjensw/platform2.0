import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["indicator", "svg"]

    connect() {
        this.connectMode = false
        this.fromResourceId = null
    }

    start(e) {
        this.fromResourceId = e.params.resourceId
        this.connectMode = true
        this.indicatorTarget.hidden = false
        this.element.classList.add("canvas-layout--connecting")

        // Listen for clicks on blocks
        this.element.querySelectorAll(".canvas-block").forEach(block => {
            if (block.dataset.resourceId !== this.fromResourceId) {
                block.classList.add("canvas-block--connectable")
                block.addEventListener("click", this.handleConnect, { once: true })
            }
        })
    }

    handleConnect = async (e) => {
        e.stopPropagation()
        const toResourceId = e.target.closest(".canvas-block")?.dataset.resourceId
        if (!toResourceId || toResourceId === this.fromResourceId) return

        const canvasCtrl = this.application.getControllerForElementAndIdentifier(
            this.element.closest("[data-controller~='canvas']"), "canvas"
        )
        if (!canvasCtrl) return

        const resp = await fetch(canvasCtrl.connectionsUrlValue, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || ""
            },
            body: JSON.stringify({
                from_resource_id: this.fromResourceId,
                to_resource_id: toResourceId,
                connection_type: "dependency"
            })
        })

        if (resp.ok) {
            // Reload to get updated connections
            canvasCtrl.loadResources()
        }

        this.cancel()
    }

    cancel() {
        this.connectMode = false
        this.fromResourceId = null
        this.indicatorTarget.hidden = true
        this.element.classList.remove("canvas-layout--connecting")
        this.element.querySelectorAll(".canvas-block--connectable").forEach(b => {
            b.classList.remove("canvas-block--connectable")
            b.removeEventListener("click", this.handleConnect)
        })
    }
}

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["overlay", "title", "progress", "progressBar", "step", "error",
        "diagramContainer", "actions", "generateBtn"]
    static values = {
        apiBase: String,     // /customers/:uuid/api/documentation
        provider: String,    // aws or azure
        accountId: String,
        subscriptionId: String,
        projectUuid: String,
        envName: String
    }

    connect() {
        this.taskId = null
        this.pollTimer = null
    }

    disconnect() {
        this.stopPolling()
    }

    open(event) {
        // Read data attributes from the clicked element
        const el = event.currentTarget
        this.providerValue = el.dataset.provider || this.providerValue
        this.accountIdValue = el.dataset.accountId || this.accountIdValue
        this.subscriptionIdValue = el.dataset.subscriptionId || this.subscriptionIdValue
        this.projectUuidValue = el.dataset.projectUuid || this.projectUuidValue
        this.envNameValue = el.dataset.envName || this.envNameValue

        // Reset state
        this.taskId = null
        this.stopPolling()
        this.titleTarget.textContent = `Documentation — ${this.envNameValue}`
        this.errorTarget.textContent = ""
        this.errorTarget.style.display = "none"
        this.progressTarget.textContent = "Ready to generate"
        this.progressBarTarget.style.width = "0%"
        this.stepTarget.textContent = ""
        this.diagramContainerTarget.innerHTML = ""
        this.diagramContainerTarget.style.display = "none"
        this.actionsTarget.style.display = "none"
        if (this.hasGenerateBtnTarget) this.generateBtnTarget.disabled = false

        this.overlayTarget.style.display = "flex"
    }

    close() {
        this.overlayTarget.style.display = "none"
        this.stopPolling()
    }

    backdropClose(event) {
        if (event.target === this.overlayTarget) this.close()
    }

    closeOnEscape(event) {
        if (event.key === "Escape" && this.overlayTarget.style.display === "flex") this.close()
    }

    async generate() {
        if (this.hasGenerateBtnTarget) this.generateBtnTarget.disabled = true
        this.errorTarget.style.display = "none"

        if (this.providerValue === "aws") {
            await this.generateAws()
        } else {
            await this.generateAzure()
        }
    }

    async generateAws() {
        this.progressTarget.textContent = "Fetching documentation…"
        this.progressBarTarget.style.width = "50%"

        try {
            const accountId = this.accountIdValue
            const url = `${this.apiBaseValue}/aws/${accountId}`
            const resp = await fetch(url, { headers: this.headers() })

            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}))
                throw new Error(data.error || `Failed (${resp.status})`)
            }

            this.progressBarTarget.style.width = "100%"
            this.progressTarget.textContent = "Complete"

            const data = await resp.json()
            this.showResult(data)
        } catch (e) {
            this.showError(e.message)
        }
    }

    async generateAzure() {
        this.progressTarget.textContent = "Starting generation…"
        this.progressBarTarget.style.width = "5%"

        try {
            const resp = await fetch(`${this.apiBaseValue}/generate`, {
                method: "POST",
                headers: { ...this.headers(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    project_uuid: this.projectUuidValue,
                    subscription_id: this.subscriptionIdValue,
                    provider: "azure",
                    options: {
                        output_format: "png",
                        layout: "by_resource_group",
                        include_relationships: true
                    }
                })
            })

            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}))
                throw new Error(data.error || `Failed to start (${resp.status})`)
            }

            const data = await resp.json()
            this.taskId = data.task_id
            this.progressTarget.textContent = "Queued — waiting for processing…"
            this.progressBarTarget.style.width = "10%"
            this.startPolling()
        } catch (e) {
            this.showError(e.message)
        }
    }

    startPolling() {
        this.pollTimer = setInterval(() => this.pollStatus(), 3000)
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer)
            this.pollTimer = null
        }
    }

    async pollStatus() {
        if (!this.taskId) return

        try {
            const resp = await fetch(`${this.apiBaseValue}/status/${this.taskId}`, {
                headers: this.headers()
            })

            if (!resp.ok) return

            const data = await resp.json()
            const progress = data.progress || 0
            this.progressBarTarget.style.width = `${Math.max(progress, 5)}%`
            this.stepTarget.textContent = data.current_step || ""

            if (data.status === "processing" || data.status === "queued") {
                this.progressTarget.textContent = data.status === "queued"
                    ? "Queued — waiting for processing…"
                    : `Processing… ${progress}%`
            } else if (data.status === "completed") {
                this.stopPolling()
                this.progressBarTarget.style.width = "100%"
                this.progressTarget.textContent = "Complete"
                this.showResult(data)
            } else if (data.status === "failed") {
                this.stopPolling()
                this.showError(data.error || "Generation failed")
            }
        } catch (e) {
            // Silently retry on network errors
        }
    }

    showResult(data) {
        const container = this.diagramContainerTarget
        container.innerHTML = ""

        if (data.diagram_base64) {
            const img = document.createElement("img")
            img.src = `data:image/png;base64,${data.diagram_base64}`
            img.alt = "Infrastructure diagram"
            img.style.cssText = "max-width:100%;border-radius:8px;border:1px solid var(--border);"
            container.appendChild(img)
            container.style.display = "block"
        }

        // Show action buttons
        this.actionsTarget.style.display = "flex"
        this.actionsTarget.innerHTML = ""

        if (data.diagram_base64) {
            const dlDiagram = document.createElement("button")
            dlDiagram.className = "btn btn-ghost btn-sm"
            dlDiagram.textContent = "⬇ Download Diagram"
            dlDiagram.onclick = () => this.downloadBase64(data.diagram_base64, "diagram.png", "image/png")
            this.actionsTarget.appendChild(dlDiagram)
        }

        if (data.pdf_base64) {
            const dlPdf = document.createElement("button")
            dlPdf.className = "btn btn-green btn-sm"
            dlPdf.textContent = "⬇ Download PDF"
            dlPdf.onclick = () => this.downloadBase64(data.pdf_base64, "documentation.pdf", "application/pdf")
            this.actionsTarget.appendChild(dlPdf)
        }

        if (this.hasGenerateBtnTarget) {
            this.generateBtnTarget.disabled = false
            this.generateBtnTarget.textContent = "↻ Regenerate"
        }
    }

    showError(message) {
        this.errorTarget.textContent = message
        this.errorTarget.style.display = "block"
        this.progressTarget.textContent = "Failed"
        if (this.hasGenerateBtnTarget) this.generateBtnTarget.disabled = false
    }

    downloadBase64(base64, filename, mimeType) {
        const byteChars = atob(base64)
        const byteNumbers = new Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    headers() {
        const token = document.querySelector('meta[name="csrf-token"]')?.content
        return token ? { "X-CSRF-Token": token } : {}
    }
}

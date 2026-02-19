import { Controller } from "@hotwired/stimulus"
import { escapeHtml } from "../helpers/sanitize"

const CATEGORY_COLORS = {
    compute: { color: "#ff9900", label: "Compute" },
    database: { color: "#3b82f6", label: "Database" },
    networking: { color: "#8b5cf6", label: "Networking" },
    storage: { color: "#10b981", label: "Storage" },
    security: { color: "#ef4444", label: "Security" },
    monitoring: { color: "#22d3ee", label: "Monitoring" },
    other: { color: "#8b99b5", label: "Other" }
}

export default class extends Controller {
    static targets = ["overlay", "input", "results"]

    connect() {
        this.highlightIndex = -1
        document.addEventListener("keydown", this.handleGlobalKey)
    }

    disconnect() {
        document.removeEventListener("keydown", this.handleGlobalKey)
    }

    handleGlobalKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault()
            this.open()
        }
    }

    open() {
        this.overlayTarget.classList.add("open")
        this.inputTarget.value = ""
        this.inputTarget.focus()
        this.showDefaultResults()
    }

    close() {
        this.overlayTarget.classList.remove("open")
        this.highlightIndex = -1
    }

    backdropClose(e) {
        if (e.target === this.overlayTarget) this.close()
    }

    stopProp(e) { e.stopPropagation() }

    search() {
        const query = this.inputTarget.value.toLowerCase().trim()
        if (!query) { this.showDefaultResults(); return }

        const canvas = this.canvasController
        if (!canvas) return

        const resources = canvas.resourcesValue || []
        const modules = this.catalogModules

        const matchedResources = resources.filter(r =>
            r.name.toLowerCase().includes(query) ||
            r.module_definition.display_name.toLowerCase().includes(query)
        ).slice(0, 8)

        const matchedModules = modules.filter(m =>
            (m.display_name || m.name || "").toLowerCase().includes(query)
        ).slice(0, 5)

        let html = ""
        if (matchedResources.length) {
            html += `<div class="cmd-section">Resources</div>`
            matchedResources.forEach(r => {
                const cat = CATEGORY_COLORS[r.module_definition.category] || CATEGORY_COLORS.other
                html += `<div class="cmd-item" data-action="click->cmd-palette#selectResource" data-resource-id="${escapeHtml(r.id)}">
          <div class="cmd-item-icon" style="background:${cat.color}1f;color:${cat.color}">${escapeHtml(r.module_definition.icon || "?")}</div>
          <div class="cmd-item-name">${escapeHtml(r.name)}</div>
          <div class="cmd-item-hint">${escapeHtml(r.module_definition.display_name)}</div>
        </div>`
            })
        }
        if (matchedModules.length) {
            html += `<div class="cmd-section">Add Module</div>`
            matchedModules.forEach(m => {
                html += `<div class="cmd-item" data-action="click->cmd-palette#addModule" data-module-id="${escapeHtml(m.id)}">
          <div class="cmd-item-icon" style="font-size:10px;">+</div>
          <div class="cmd-item-name">Add ${escapeHtml(m.display_name || m.name)}</div>
          <div class="cmd-item-hint">${escapeHtml(m.category)}</div>
        </div>`
            })
        }
        if (!html) html = `<div class="cmd-empty">No results for "${escapeHtml(query)}"</div>`
        this.resultsTarget.innerHTML = html
        this.highlightIndex = -1
    }

    showDefaultResults() {
        const canvas = this.canvasController
        const resources = canvas?.resourcesValue || []
        const modules = this.catalogModules

        let html = ""
        if (resources.length) {
            html += `<div class="cmd-section">Resources (${resources.length})</div>`
            resources.slice(0, 8).forEach(r => {
                const cat = CATEGORY_COLORS[r.module_definition.category] || CATEGORY_COLORS.other
                html += `<div class="cmd-item" data-action="click->cmd-palette#selectResource" data-resource-id="${escapeHtml(r.id)}">
          <div class="cmd-item-icon" style="background:${cat.color}1f;color:${cat.color}">${escapeHtml(r.module_definition.icon || "?")}</div>
          <div class="cmd-item-name">${escapeHtml(r.name)}</div>
          <div class="cmd-item-hint">${escapeHtml(r.module_definition.display_name)}</div>
        </div>`
            })
        }
        if (modules.length) {
            html += `<div class="cmd-section">Quick Add</div>`
            modules.slice(0, 5).forEach(m => {
                html += `<div class="cmd-item" data-action="click->cmd-palette#addModule" data-module-id="${escapeHtml(m.id)}">
          <div class="cmd-item-icon" style="font-size:10px;">+</div>
          <div class="cmd-item-name">Add ${escapeHtml(m.display_name || m.name)}</div>
          <div class="cmd-item-hint">${escapeHtml(m.category)}</div>
        </div>`
            })
        }
        if (!html) html = `<div class="cmd-empty">Start typing to search...</div>`
        this.resultsTarget.innerHTML = html
    }

    navigate(e) {
        const items = this.resultsTarget.querySelectorAll(".cmd-item")
        if (e.key === "ArrowDown") { e.preventDefault(); this.highlightIndex = Math.min(this.highlightIndex + 1, items.length - 1) }
        else if (e.key === "ArrowUp") { e.preventDefault(); this.highlightIndex = Math.max(this.highlightIndex - 1, 0) }
        else if (e.key === "Enter" && this.highlightIndex >= 0) { e.preventDefault(); items[this.highlightIndex]?.click() }
        else if (e.key === "Escape") { this.close(); return }
        else return
        items.forEach((item, i) => item.classList.toggle("highlighted", i === this.highlightIndex))
    }

    selectResource(e) {
        const id = e.currentTarget.dataset.resourceId
        const canvas = this.canvasController
        if (canvas) canvas.selectResource(id)
        this.close()
    }

    addModule(e) {
        const moduleId = e.currentTarget.dataset.moduleId
        const canvas = this.canvasController
        if (canvas) canvas.addResource(moduleId)
        this.close()
    }

    get canvasController() {
        return this.application.getControllerForElementAndIdentifier(this.element, "canvas-main")
    }

    get catalogModules() {
        // Read from the catalog panel DOM
        const items = this.element.querySelectorAll(".mod-item")
        return Array.from(items).map(el => ({
            id: el.dataset.moduleId,
            name: el.dataset.moduleName,
            display_name: el.dataset.moduleDisplay,
            icon: el.dataset.moduleIcon,
            category: el.dataset.moduleCategory,
            cloud_provider: el.dataset.moduleProvider
        }))
    }
}

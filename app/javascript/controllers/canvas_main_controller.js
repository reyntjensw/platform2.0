import { Controller } from "@hotwired/stimulus"

const CATEGORY_COLORS = {
    compute: { color: "#ff9900", bg: "rgba(255,153,0,0.12)", label: "Compute" },
    database: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", label: "Database" },
    networking: { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", label: "Networking" },
    storage: { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "Storage" },
    security: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Security" },
    monitoring: { color: "#22d3ee", bg: "rgba(34,211,238,0.12)", label: "Monitoring" },
    other: { color: "#8b99b5", bg: "rgba(139,153,181,0.12)", label: "Other" }
}

export default class extends Controller {
    static targets = [
        "canvasArea", "transform", "viewport", "svg", "blocks", "empty",
        "connectIndicator", "zoomLevel", "envTabs",
        "minimap", "minimapLabel", "minimapCanvas", "minimapDots", "minimapViewport",
        "zonePub", "zonePrv",
        "catalogPanel", "catalogSearch", "catalogList",
        "propsEmpty", "propsContent", "propsFrame",
        "validContent", "xrefsContent"
    ]

    static values = {
        resources: Array,
        connections: Array,
        apiUrl: String,
        connectionsApiUrl: String,
        environmentId: String
    }

    connect() {
        this._zoom = 1.0
        this.panX = 0
        this.panY = 0
        this.selectedId = null
        this.connectMode = false
        this.connectFromId = null
        this.dragging = null
        this.panning = false
        this.cloudFilter = null // null = show all

        this.render()
    }

    // ── Catalog: search filter ──
    filterCatalog() {
        const q = this.catalogSearchTarget.value.toLowerCase()
        this.catalogListTarget.querySelectorAll(".mod-item").forEach(item => {
            const name = (item.dataset.moduleDisplay || "").toLowerCase()
            const cat = (item.dataset.moduleCategory || "").toLowerCase()
            const matchQ = !q || name.includes(q) || cat.includes(q)
            const matchCloud = !this.cloudFilter || item.dataset.moduleProvider === this.cloudFilter
            item.style.display = (matchQ && matchCloud) ? "" : "none"
        })
        // Show/hide category titles
        this.catalogListTarget.querySelectorAll(".cat-title").forEach(title => {
            const cat = title.dataset.category
            const hasVisible = !!this.catalogListTarget.querySelector(`.mod-item[data-module-category="${cat}"]:not([style*="display: none"])`)
            title.style.display = hasVisible ? "" : "none"
        })
    }

    toggleCloudFilter(e) {
        const provider = e.params.provider
        const chip = e.currentTarget
        const wasActive = chip.classList.contains("aws-on") || chip.classList.contains("azure-on")

        // Reset all chips
        this.element.querySelectorAll(".cloud-chip").forEach(c => {
            c.classList.remove("aws-on", "azure-on")
        })

        if (wasActive) {
            this.cloudFilter = null
        } else {
            this.cloudFilter = provider
            chip.classList.add(provider === "aws" ? "aws-on" : "azure-on")
        }
        this.filterCatalog()
    }

    // ── Catalog: drag to canvas ──
    catalogDragStart(e) {
        const item = e.currentTarget
        e.dataTransfer.setData("text/plain", item.dataset.moduleId)
        e.dataTransfer.effectAllowed = "copy"
        item.classList.add("dragging")
    }

    catalogDragEnd(e) {
        e.currentTarget.classList.remove("dragging")
    }

    catalogDragOver(e) {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
    }

    async catalogDrop(e) {
        e.preventDefault()
        const moduleId = e.dataTransfer.getData("text/plain")
        if (!moduleId) return

        // Calculate drop position in viewport coordinates
        const vpRect = this.viewportTarget.getBoundingClientRect()
        const x = (e.clientX - vpRect.left) / this._zoom
        const y = (e.clientY - vpRect.top) / this._zoom

        await this.addResource(moduleId, Math.max(0, x), Math.max(0, y))
    }

    catalogClick(e) {
        const item = e.currentTarget
        this.addResource(item.dataset.moduleId)
    }

    // ── Rendering ──
    render() {
        this.blocksTarget.innerHTML = ""
        const resources = this.resourcesValue

        this.emptyTarget.hidden = resources.length > 0

        resources.forEach(r => {
            const el = this.createBlock(r)
            this.blocksTarget.appendChild(el)
        })

        this.renderConnections()
        this.updateMinimap()
    }

    createBlock(resource) {
        const el = document.createElement("div")
        const cat = resource.module_definition.category
        const catInfo = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other

        el.className = `rb${resource.id === this.selectedId ? " selected" : ""}`
        el.dataset.resourceId = resource.id
        el.dataset.category = cat
        el.style.left = `${resource.position_x || 50}px`
        el.style.top = `${resource.position_y || 50}px`

        const icon = resource.module_definition.icon || cat.substring(0, 3).toUpperCase()
        const errCount = (resource.validation_errors || []).length

        el.innerHTML = `
      <div class="rb-i" style="background:${catInfo.bg};color:${catInfo.color}">${icon}</div>
      <div>
        <div class="rb-n">${resource.name}</div>
        <div class="rb-t">${resource.module_definition.display_name}</div>
      </div>
      ${errCount > 0 ? `<div class="rb-badge" style="background:var(--accent-red)">!</div>` : ""}
    `

        el.addEventListener("mousedown", (e) => this.startDrag(e, resource, el))
        el.addEventListener("click", (e) => {
            e.stopPropagation()
            if (this.connectMode) {
                this.completeConnect(resource.id)
            } else if (!this.dragging?.moved) {
                this.selectResource(resource.id)
            }
        })

        return el
    }

    // ── Drag & Drop (resource blocks) ──
    startDrag(e, resource, el) {
        if (e.button !== 0 || this.connectMode) return
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        this.dragging = {
            resource, el,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            moved: false, startX: e.clientX, startY: e.clientY
        }

        const onMove = (e) => {
            if (Math.abs(e.clientX - this.dragging.startX) > 3 || Math.abs(e.clientY - this.dragging.startY) > 3) {
                this.dragging.moved = true
            }
            if (!this.dragging.moved) return
            const vpRect = this.viewportTarget.getBoundingClientRect()
            const x = (e.clientX - vpRect.left - this.dragging.offsetX) / this._zoom
            const y = (e.clientY - vpRect.top - this.dragging.offsetY) / this._zoom
            el.style.left = `${Math.max(0, x)}px`
            el.style.top = `${Math.max(0, y)}px`
            this.renderConnections()
            this.updateMinimap()
        }

        const onUp = async () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            if (this.dragging?.moved) {
                const x = parseFloat(el.style.left)
                const y = parseFloat(el.style.top)
                resource.position_x = x
                resource.position_y = y
                const idx = this.resourcesValue.findIndex(r => r.id === resource.id)
                if (idx >= 0) {
                    const updated = [...this.resourcesValue]
                    updated[idx] = { ...updated[idx], position_x: x, position_y: y }
                    this.resourcesValue = updated
                }
                await fetch(`${this.apiUrlValue}/${resource.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": this.csrf },
                    body: JSON.stringify({ position_x: x, position_y: y })
                })
            }
            this.dragging = null
        }

        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    // ── Selection ──
    selectResource(resourceId) {
        this.selectedId = resourceId
        this.blocksTarget.querySelectorAll(".rb").forEach(b => {
            b.classList.toggle("selected", b.dataset.resourceId === resourceId)
        })
        this.loadProperties(resourceId)

        // Scroll to Properties section in right panel
        const rpanelEl = this.element.querySelector("[data-controller~='rpanel']")
        if (rpanelEl) {
            const rpanel = this.application.getControllerForElementAndIdentifier(rpanelEl, "rpanel")
            if (rpanel) rpanel.scrollTo({ params: { section: "props" } })
        }
    }

    deselectAll() {
        this.selectedId = null
        this.blocksTarget.querySelectorAll(".selected").forEach(b => b.classList.remove("selected"))
        if (this.hasPropsEmptyTarget) this.propsEmptyTarget.hidden = false
        if (this.hasPropsContentTarget) this.propsContentTarget.hidden = true
    }

    // ── Properties ──
    async loadProperties(resourceId) {
        this.propsEmptyTarget.hidden = true
        this.propsContentTarget.hidden = false
        const url = `${this.apiUrlValue}/${resourceId}/properties`
        const resp = await fetch(url, { headers: { Accept: "text/html" } })
        if (resp.ok) this.propsFrameTarget.innerHTML = await resp.text()
    }

    async saveProperties(e) {
        e.preventDefault()
        const form = e.target
        const resourceId = form.dataset.resourceId
        const formData = new FormData(form)
        const config = {}
        for (const [key, value] of formData.entries()) {
            const m = key.match(/^config\[(.+)\]$/)
            if (m) {
                let v = value
                if (v === "true") v = true
                else if (v === "false") v = false
                else if (/^\d+$/.test(v)) v = parseInt(v, 10)
                config[m[1]] = v
            }
        }
        const resp = await fetch(`${this.apiUrlValue}/${resourceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": this.csrf },
            body: JSON.stringify({ config })
        })
        if (resp.ok) this.loadProperties(resourceId)
    }

    async deleteResource(e) {
        const resourceId = e.target.closest("[data-resource-id]")?.dataset.resourceId || this.selectedId
        if (!resourceId) return
        const res = this.resourcesValue.find(r => r.id === resourceId)
        const name = res?.name || "this resource"
        this._showDeleteModal(name, async () => {
            const resp = await fetch(`${this.apiUrlValue}/${resourceId}`, {
                method: "DELETE", headers: { "X-CSRF-Token": this.csrf }
            })
            if (resp.ok) {
                this.resourcesValue = this.resourcesValue.filter(r => r.id !== resourceId)
                this.connectionsValue = this.connectionsValue.filter(c =>
                    c.from_resource_id !== resourceId && c.to_resource_id !== resourceId
                )
                if (this.selectedId === resourceId) this.deselectAll()
                this.render()
            }
        })
    }

    _showDeleteModal(resourceName, onConfirm) {
        // Remove any existing modal
        document.getElementById("stim-delete-modal")?.remove()

        const overlay = document.createElement("div")
        overlay.id = "stim-delete-modal"
        overlay.className = "modal-overlay"
        overlay.style.display = "flex"

        overlay.innerHTML = `
          <div class="modal-panel" style="max-width:420px;">
            <div class="modal-header">
              <h3 class="modal-title" style="color:var(--red);">Delete Resource</h3>
              <button class="modal-close" data-dismiss aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
              <p style="font-size:13px;color:var(--text-secondary);">
                Are you sure you want to delete <span style="font-weight:600;color:var(--text-primary);">${resourceName}</span>?
                This will also remove all its connections.
              </p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-ghost" data-dismiss>Cancel</button>
              <button type="button" class="btn btn-danger" data-confirm>Delete</button>
            </div>
          </div>
        `

        const close = () => overlay.remove()
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay || e.target.closest("[data-dismiss]")) close()
            if (e.target.closest("[data-confirm]")) { close(); onConfirm() }
        })
        document.body.appendChild(overlay)
    }

    // ── Add Resource ──
    async addResource(moduleId, posX, posY) {
        const body = { module_definition_id: moduleId }
        if (posX != null) body.position_x = posX
        if (posY != null) body.position_y = posY

        const resp = await fetch(this.apiUrlValue, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": this.csrf },
            body: JSON.stringify(body)
        })
        if (resp.ok) {
            const resource = await resp.json()
            resource.connections = resource.connections || { outgoing: [], incoming: [] }
            this.resourcesValue = [...this.resourcesValue, resource]
            this.render()
            this.selectResource(resource.id)
        }
    }

    // ── Connections ──
    startConnectMode() {
        if (this.selectedId) {
            this.startConnect(this.selectedId)
        }
    }

    startConnect(resourceId) {
        this.connectMode = true
        this.connectFromId = resourceId || this.selectedId
        this.connectIndicatorTarget.classList.add("active")
        this.canvasAreaTarget.classList.add("connect-mode")
        const src = this.blocksTarget.querySelector(`[data-resource-id="${this.connectFromId}"]`)
        if (src) src.classList.add("connecting")
    }

    completeConnect(toResourceId) {
        if (!this.connectFromId || toResourceId === this.connectFromId) return
        const exists = this.connectionsValue.some(c =>
            c.from_resource_id === this.connectFromId && c.to_resource_id === toResourceId
        )
        if (exists) { this.cancelConnect(); return }

        fetch(this.connectionsApiUrlValue, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": this.csrf },
            body: JSON.stringify({ from_resource_id: this.connectFromId, to_resource_id: toResourceId, connection_type: "dependency" })
        }).then(resp => {
            if (resp.ok) return resp.json()
        }).then(conn => {
            if (conn) {
                this.connectionsValue = [...this.connectionsValue, conn]
                this.render()
            }
        })
        this.cancelConnect()
    }

    cancelConnect() {
        this.connectMode = false
        this.connectFromId = null
        this.connectIndicatorTarget.classList.remove("active")
        this.canvasAreaTarget.classList.remove("connect-mode")
        this.blocksTarget.querySelectorAll(".connecting").forEach(b => b.classList.remove("connecting"))
    }

    // ── SVG Connections ──
    renderConnections() {
        const svg = this.svgTarget
        svg.innerHTML = ""

        this.connectionsValue.forEach(c => {
            const fromEl = this.blocksTarget.querySelector(`[data-resource-id="${c.from_resource_id}"]`)
            const toEl = this.blocksTarget.querySelector(`[data-resource-id="${c.to_resource_id}"]`)
            if (!fromEl || !toEl) return

            const x1 = parseFloat(fromEl.style.left) + fromEl.offsetWidth / 2
            const y1 = parseFloat(fromEl.style.top) + fromEl.offsetHeight / 2
            const x2 = parseFloat(toEl.style.left) + toEl.offsetWidth / 2
            const y2 = parseFloat(toEl.style.top) + toEl.offsetHeight / 2
            const offset = Math.abs(x2 - x1) * 0.4

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
            path.setAttribute("d", `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`)
            path.setAttribute("class", "conn-line")
            svg.appendChild(path)
        })
    }

    // ── Pan & Zoom ──
    panStart(e) {
        if (e.target.closest(".rb") || e.target.closest(".subnet") || e.button !== 0) return
        if (this.connectMode) { this.cancelConnect(); return }
        this.deselectAll()
        e.preventDefault()
        this.panning = true
        const startX = e.clientX, startY = e.clientY
        const origPanX = this.panX, origPanY = this.panY

        const onMove = (e) => {
            this.panX = origPanX + (e.clientX - startX)
            this.panY = origPanY + (e.clientY - startY)
            this.applyTransform()
        }
        const onUp = () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            this.panning = false
        }
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    handleWheel(e) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.05 : 0.05
        this.setZoom(Math.max(0.3, Math.min(2.0, this._zoom + delta)))
    }

    zoomIn() { this.setZoom(Math.min(2.0, this._zoom + 0.1)) }
    zoomOut() { this.setZoom(Math.max(0.3, this._zoom - 0.1)) }

    setZoom(level) {
        this._zoom = level
        this.applyTransform()
        this.zoomLevelTarget.textContent = `${Math.round(level * 100)}%`
    }

    fitAll() {
        const blocks = this.blocksTarget.querySelectorAll(".rb")
        if (blocks.length === 0) return
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        blocks.forEach(b => {
            const x = parseFloat(b.style.left), y = parseFloat(b.style.top)
            minX = Math.min(minX, x); minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + b.offsetWidth); maxY = Math.max(maxY, y + b.offsetHeight)
        })
        const tRect = this.transformTarget.getBoundingClientRect()
        const padding = 60
        const scaleX = (tRect.width - padding * 2) / (maxX - minX + 100)
        const scaleY = (tRect.height - padding * 2) / (maxY - minY + 100)
        this._zoom = Math.max(0.3, Math.min(1.5, Math.min(scaleX, scaleY)))
        this.panX = padding - minX * this._zoom + 20
        this.panY = padding - minY * this._zoom + 20
        this.applyTransform()
        this.zoomLevelTarget.textContent = `${Math.round(this._zoom * 100)}%`
    }

    applyTransform() {
        this.viewportTarget.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this._zoom})`
        this.updateMinimap()
    }

    setTool(e) {
        // Reset connect mode if active
        if (this.connectMode) this.cancelConnect()
    }

    // ── Minimap ──
    updateMinimap() {
        if (!this.hasMinimapDotsTarget) return
        const all = this.resourcesValue
        if (all.length === 0) return

        let maxX = 800, maxY = 500
        all.forEach(r => {
            maxX = Math.max(maxX, (r.position_x || 0) + 150)
            maxY = Math.max(maxY, (r.position_y || 0) + 50)
        })

        const mmW = this.minimapCanvasTarget.offsetWidth
        const mmH = this.minimapCanvasTarget.offsetHeight
        const scaleX = mmW / maxX
        const scaleY = mmH / maxY

        this.minimapDotsTarget.innerHTML = all.map(r => {
            const cat = r.module_definition.category
            const catInfo = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other
            const x = (r.position_x || 0) * scaleX
            const y = (r.position_y || 0) * scaleY
            return `<div class="mm-block" style="left:${x}px;top:${y}px;background:${catInfo.color}"></div>`
        }).join("")

        const tRect = this.transformTarget.getBoundingClientRect()
        const vpW = (tRect.width / this._zoom) * scaleX
        const vpH = (tRect.height / this._zoom) * scaleY
        const vpX = (-this.panX / this._zoom) * scaleX
        const vpY = (-this.panY / this._zoom) * scaleY
        this.minimapViewportTarget.style.left = `${Math.max(0, vpX)}px`
        this.minimapViewportTarget.style.top = `${Math.max(0, vpY)}px`
        this.minimapViewportTarget.style.width = `${Math.min(mmW, vpW)}px`
        this.minimapViewportTarget.style.height = `${Math.min(mmH, vpH)}px`

        this.minimapLabelTarget.textContent = `Minimap · ${all.length} resources`
    }

    // ── Deploy ──
    deploy() {
        alert("Deploy triggered — pipeline integration coming in next slice")
    }

    // ── Helpers ──
    get csrf() {
        return document.querySelector('meta[name="csrf-token"]')?.content || ""
    }
}

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["area", "surface", "blocks", "svg", "empty"]
    static values = { apiUrl: String, connectionsUrl: String, environmentId: String }

    connect() {
        this.resources = []
        this.selectedId = null
        this.dragging = null
        this.loadResources()
    }

    async loadResources() {
        const resp = await fetch(this.apiUrlValue, { headers: { "Accept": "application/json" } })
        this.resources = await resp.json()
        this.render()
    }

    render() {
        this.blocksTarget.innerHTML = ""
        this.emptyTarget.hidden = this.resources.length > 0

        this.resources.forEach(r => {
            const block = this.createBlock(r)
            this.blocksTarget.appendChild(block)
        })

        this.renderConnections()
    }

    createBlock(resource) {
        const el = document.createElement("div")
        el.className = "canvas-block"
        el.dataset.resourceId = resource.id
        el.style.left = `${resource.position_x}px`
        el.style.top = `${resource.position_y}px`

        if (resource.id === this.selectedId) el.classList.add("canvas-block--selected")

        el.innerHTML = `
      <span class="canvas-block__icon">${resource.module_definition.icon}</span>
      <span class="canvas-block__name">${resource.name}</span>
      <span class="canvas-block__type">${resource.module_definition.display_name}</span>
    `

        el.addEventListener("mousedown", (e) => this.startDrag(e, resource, el))
        el.addEventListener("click", (e) => {
            e.stopPropagation()
            this.select(resource.id)
        })

        return el
    }

    startDrag(e, resource, el) {
        if (e.button !== 0) return
        e.preventDefault()

        const rect = el.getBoundingClientRect()
        this.dragging = {
            resource, el,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            moved: false
        }

        const onMove = (e) => {
            this.dragging.moved = true
            const surfaceRect = this.surfaceTarget.getBoundingClientRect()
            const x = e.clientX - surfaceRect.left - this.dragging.offsetX
            const y = e.clientY - surfaceRect.top - this.dragging.offsetY
            el.style.left = `${Math.max(0, x)}px`
            el.style.top = `${Math.max(0, y)}px`
            this.renderConnections()
        }

        const onUp = async () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)

            if (this.dragging?.moved) {
                const x = parseFloat(el.style.left)
                const y = parseFloat(el.style.top)
                await fetch(`${this.apiUrlValue}/${resource.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": this.csrfToken },
                    body: JSON.stringify({ position_x: x, position_y: y })
                })
                resource.position_x = x
                resource.position_y = y
            }
            this.dragging = null
        }

        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    select(resourceId) {
        if (this.dragging?.moved) return

        this.selectedId = resourceId
        this.blocksTarget.querySelectorAll(".canvas-block").forEach(b => {
            b.classList.toggle("canvas-block--selected", b.dataset.resourceId === resourceId)
        })

        this.dispatch("selected", { detail: { resourceId } })
    }

    deselect(e) {
        if (e.target.closest(".canvas-block") || e.target.closest(".canvas-catalog") || e.target.closest(".canvas-properties")) return
        this.selectedId = null
        this.blocksTarget.querySelectorAll(".canvas-block--selected").forEach(b => b.classList.remove("canvas-block--selected"))
        this.dispatch("deselected")
    }

    addResource(resource) {
        this.resources.push(resource)
        this.render()
        this.select(resource.id)
    }

    removeResource(resourceId) {
        this.resources = this.resources.filter(r => r.id !== resourceId)
        if (this.selectedId === resourceId) this.selectedId = null
        this.render()
        this.dispatch("deselected")
    }

    renderConnections() {
        const svg = this.svgTarget
        svg.innerHTML = ""
        const surfaceRect = this.surfaceTarget.getBoundingClientRect()

        this.resources.forEach(r => {
            (r.connections?.outgoing || []).forEach(conn => {
                const fromEl = this.blocksTarget.querySelector(`[data-resource-id="${r.id}"]`)
                const toEl = this.blocksTarget.querySelector(`[data-resource-id="${conn.to_resource_id}"]`)
                if (!fromEl || !toEl) return

                const fromRect = fromEl.getBoundingClientRect()
                const toRect = toEl.getBoundingClientRect()

                const x1 = fromRect.left + fromRect.width / 2 - surfaceRect.left
                const y1 = fromRect.top + fromRect.height / 2 - surfaceRect.top
                const x2 = toRect.left + toRect.width / 2 - surfaceRect.left
                const y2 = toRect.top + toRect.height / 2 - surfaceRect.top

                const midX = (x1 + x2) / 2
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
                path.setAttribute("d", `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`)
                path.setAttribute("class", "canvas-connection-line")
                path.dataset.connectionId = conn.id
                svg.appendChild(path)
            })
        })
    }

    get csrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || ""
    }
}

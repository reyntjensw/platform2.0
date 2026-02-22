import React, { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { catFor } from "./constants"

export default function CanvasArea({
  resources, connections, selectedId, selectResource, deselectAll,
  updateResourcePosition, addResource,
  connectMode, connectFromId, completeConnect, cancelConnect, startConnect,
  onOpenCmd, siblingEnvs, environment, canvasPath, appGroups, readOnly
}) {
  const [zoom, setZoomState] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const viewportRef = useRef(null)
  const transformRef = useRef(null)
  const svgRef = useRef(null)
  const blocksRef = useRef(null)
  const panningRef = useRef(false)
  const dragRef = useRef(null)
  const rubberBandRef = useRef(null)
  const mouseCanvasRef = useRef({ x: 0, y: 0 })

  const setZoom = useCallback((z) => {
    setZoomState(Math.max(0.3, Math.min(2.0, z)))
  }, [])

  // Render SVG connections
  useEffect(() => {
    if (!svgRef.current || !blocksRef.current) return
    const svg = svgRef.current
    svg.innerHTML = ""
    connections.forEach(c => {
      const fromEl = blocksRef.current.querySelector(`[data-rid="${c.from_resource_id}"]`)
      const toEl = blocksRef.current.querySelector(`[data-rid="${c.to_resource_id}"]`)
      if (!fromEl || !toEl) return
      const x1 = parseFloat(fromEl.style.left) + fromEl.offsetWidth / 2
      const y1 = parseFloat(fromEl.style.top) + fromEl.offsetHeight / 2
      const x2 = parseFloat(toEl.style.left) + toEl.offsetWidth / 2
      const y2 = parseFloat(toEl.style.top) + toEl.offsetHeight / 2
      const offset = Math.abs(x2 - x1) * 0.4
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.setAttribute("d", `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`)
      const isActive = selectedId && (c.from_resource_id === selectedId || c.to_resource_id === selectedId)
      path.setAttribute("class", `conn-line${isActive ? " active" : ""}`)
      svg.appendChild(path)

      // Draw arrowhead at the target end
      const angle = Math.atan2(y2 - (y2), x2 - (x2 - offset))
      const arrowLen = 8
      const ax1 = x2 - arrowLen * Math.cos(angle - 0.4)
      const ay1 = y2 - arrowLen * Math.sin(angle - 0.4)
      const ax2 = x2 - arrowLen * Math.cos(angle + 0.4)
      const ay2 = y2 - arrowLen * Math.sin(angle + 0.4)
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon")
      arrow.setAttribute("points", `${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`)
      arrow.setAttribute("fill", isActive ? "var(--green)" : "var(--text-muted)")
      arrow.setAttribute("opacity", isActive ? "1" : "0.7")
      svg.appendChild(arrow)
    })
  }, [connections, resources, selectedId])

  // Rubber-band line during connect mode
  useEffect(() => {
    if (!connectMode || !connectFromId || !viewportRef.current) {
      if (rubberBandRef.current) { rubberBandRef.current.remove(); rubberBandRef.current = null }
      return
    }
    const fromEl = blocksRef.current?.querySelector(`[data-rid="${connectFromId}"]`)
    if (!fromEl) return

    const onMove = (e) => {
      const vpRect = viewportRef.current.getBoundingClientRect()
      const mx = (e.clientX - vpRect.left) / zoom
      const my = (e.clientY - vpRect.top) / zoom
      mouseCanvasRef.current = { x: mx, y: my }

      const x1 = parseFloat(fromEl.style.left) + fromEl.offsetWidth / 2
      const y1 = parseFloat(fromEl.style.top) + fromEl.offsetHeight / 2
      const offset = Math.abs(mx - x1) * 0.3

      if (!rubberBandRef.current && svgRef.current) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
        path.setAttribute("class", "conn-line rubber-band")
        svgRef.current.appendChild(path)
        rubberBandRef.current = path
      }
      if (rubberBandRef.current) {
        rubberBandRef.current.setAttribute("d",
          `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${mx - offset} ${my}, ${mx} ${my}`
        )
      }
    }

    document.addEventListener("mousemove", onMove)
    return () => {
      document.removeEventListener("mousemove", onMove)
      if (rubberBandRef.current) { rubberBandRef.current.remove(); rubberBandRef.current = null }
    }
  }, [connectMode, connectFromId, zoom])

  // Pan handlers
  const onPanStart = useCallback((e) => {
    if (e.target.closest(".rb") || e.target.closest(".subnet") || e.button !== 0) return
    if (connectMode) { cancelConnect(); return }
    deselectAll()
    e.preventDefault()
    panningRef.current = true
    const startX = e.clientX, startY = e.clientY
    const origPan = { ...pan }
    const onMove = (e) => {
      setPan({ x: origPan.x + (e.clientX - startX), y: origPan.y + (e.clientY - startY) })
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      panningRef.current = false
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [connectMode, cancelConnect, deselectAll, pan])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom(zoom + delta)
  }, [zoom, setZoom])

  // Drag resource block (Alt+click starts connect mode)
  const onBlockMouseDown = useCallback((e, resource) => {
    if (e.button !== 0 || readOnly) return

    // Alt+click starts a connection from this resource
    if (e.altKey && !connectMode) {
      e.preventDefault()
      e.stopPropagation()
      startConnect(resource.id)
      return
    }

    if (connectMode) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const drag = {
      id: resource.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false, startX: e.clientX, startY: e.clientY
    }
    dragRef.current = drag

    const onMove = (ev) => {
      if (Math.abs(ev.clientX - drag.startX) > 3 || Math.abs(ev.clientY - drag.startY) > 3) {
        drag.moved = true
      }
      if (!drag.moved) return
      const vpRect = viewportRef.current.getBoundingClientRect()
      const x = (ev.clientX - vpRect.left - drag.offsetX) / zoom
      const y = (ev.clientY - vpRect.top - drag.offsetY) / zoom
      el.style.left = `${Math.max(0, x)}px`
      el.style.top = `${Math.max(0, y)}px`
      // Re-render connections
      if (svgRef.current && blocksRef.current) {
        svgRef.current.innerHTML = ""
        connections.forEach(c => {
          const fromEl = blocksRef.current.querySelector(`[data-rid="${c.from_resource_id}"]`)
          const toEl = blocksRef.current.querySelector(`[data-rid="${c.to_resource_id}"]`)
          if (!fromEl || !toEl) return
          const x1 = parseFloat(fromEl.style.left) + fromEl.offsetWidth / 2
          const y1 = parseFloat(fromEl.style.top) + fromEl.offsetHeight / 2
          const x2 = parseFloat(toEl.style.left) + toEl.offsetWidth / 2
          const y2 = parseFloat(toEl.style.top) + toEl.offsetHeight / 2
          const off = Math.abs(x2 - x1) * 0.4
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
          path.setAttribute("d", `M ${x1} ${y1} C ${x1 + off} ${y1}, ${x2 - off} ${y2}, ${x2} ${y2}`)
          const isActive = selectedId && (c.from_resource_id === selectedId || c.to_resource_id === selectedId)
          path.setAttribute("class", `conn-line${isActive ? " active" : ""}`)
          svgRef.current.appendChild(path)
          const angle = Math.atan2(y2 - (y2), x2 - (x2 - off))
          const arrowLen = 8
          const ax1 = x2 - arrowLen * Math.cos(angle - 0.4)
          const ay1 = y2 - arrowLen * Math.sin(angle - 0.4)
          const ax2 = x2 - arrowLen * Math.cos(angle + 0.4)
          const ay2 = y2 - arrowLen * Math.sin(angle + 0.4)
          const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon")
          arrow.setAttribute("points", `${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`)
          arrow.setAttribute("fill", isActive ? "var(--green)" : "var(--text-muted)")
          arrow.setAttribute("opacity", isActive ? "1" : "0.7")
          svgRef.current.appendChild(arrow)
        })
      }
    }

    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      if (drag.moved) {
        const x = parseFloat(el.style.left)
        const y = parseFloat(el.style.top)
        updateResourcePosition(drag.id, x, y)
      }
      dragRef.current = null
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [connectMode, zoom, connections, updateResourcePosition, readOnly, startConnect])

  const onBlockClick = useCallback((e, resource) => {
    e.stopPropagation()
    if (connectMode) {
      completeConnect(resource.id)
    } else if (!dragRef.current?.moved) {
      selectResource(resource.id)
    }
  }, [connectMode, completeConnect, selectResource])

  // Drop from catalog
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy" }

  // Escape key cancels connect mode
  useEffect(() => {
    if (!connectMode) return
    const onKey = (e) => { if (e.key === "Escape") cancelConnect() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [connectMode, cancelConnect])
  const onDrop = (e) => {
    e.preventDefault()
    if (readOnly) return
    const moduleId = e.dataTransfer.getData("text/plain")
    if (!moduleId || !viewportRef.current) return
    const vpRect = viewportRef.current.getBoundingClientRect()
    const x = (e.clientX - vpRect.left) / zoom
    const y = (e.clientY - vpRect.top) / zoom
    addResource(moduleId, Math.max(0, x), Math.max(0, y))
  }

  const fitAll = useCallback(() => {
    if (!blocksRef.current || !transformRef.current) return
    const blocks = blocksRef.current.querySelectorAll(".rb")
    if (blocks.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    blocks.forEach(b => {
      const x = parseFloat(b.style.left), y = parseFloat(b.style.top)
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + b.offsetWidth); maxY = Math.max(maxY, y + b.offsetHeight)
    })
    const tRect = transformRef.current.getBoundingClientRect()
    const padding = 60
    const scaleX = (tRect.width - padding * 2) / (maxX - minX + 100)
    const scaleY = (tRect.height - padding * 2) / (maxY - minY + 100)
    const newZoom = Math.max(0.3, Math.min(1.5, Math.min(scaleX, scaleY)))
    setZoomState(newZoom)
    setPan({ x: padding - minX * newZoom + 20, y: padding - minY * newZoom + 20 })
  }, [])

  // Compute dynamic zone groups from resource positions
  const zoneGroups = useMemo(() => {
    const groups = { public: [], private: [], global: [] }
    resources.forEach(r => {
      if (groups[r.zone]) groups[r.zone].push(r)
    })
    return groups
  }, [resources])

  const hasPublic = zoneGroups.public.length > 0
  const hasPrivate = zoneGroups.private.length > 0
  const hasGlobal = zoneGroups.global.length > 0

  function zoneBounds(list, fallback) {
    if (list.length === 0) return fallback
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    list.forEach(r => {
      const x = r.position_x || 0, y = r.position_y || 0
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    })
    const padX = 30, padY = 30, blockW = 180, blockH = 50
    return {
      left: minX - padX,
      top: minY - padY - 10,
      width: (maxX - minX) + blockW + padX * 2,
      height: (maxY - minY) + blockH + padY * 2 + 10
    }
  }

  const defaultPubZone = { left: 30, top: 30, width: 280, height: 340 }
  const defaultPrvZone = { left: 340, top: 30, width: 380, height: 340 }
  const defaultGlobalZone = { left: 30, top: 400, width: 690, height: 200 }

  const pubZone = zoneBounds(zoneGroups.public, defaultPubZone)
  const prvZone = zoneBounds(zoneGroups.private, defaultPrvZone)
  const globalZone = zoneBounds(zoneGroups.global, defaultGlobalZone)

  const dotColor = { dev: "var(--accent-green)", acc: "var(--accent-orange)", prd: "var(--accent-red)" }

  return (
    <div
      className={`cv-canvas${connectMode ? " connect-mode" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="canvas-grid" />

      {/* Toolbar */}
      <div className="toolbar">
        <button className="tool-btn" title="Select" onClick={cancelConnect}>↖</button>
        <button className="tool-btn" title="Connect" onClick={() => startConnect(selectedId)}>⤳</button>
        <button className="tool-btn" title="Fit all" onClick={fitAll}>▢</button>
        <button className="tool-btn" title="Search" onClick={onOpenCmd}>↩</button>
      </div>

      {/* Env tabs */}
      <div className="env-tabs-bar">
        {siblingEnvs.map(env => (
          <a
            key={env.id}
            href={canvasPath.replace("__ID__", env.id)}
            className={`env-tab env-${env.env_type}${env.id === environment.id ? " active" : ""}`}
          >
            <div className="env-dot" style={{ background: dotColor[env.env_type] || "var(--text-muted)" }} />
            {env.name}
          </a>
        ))}

      </div>

      {/* Connect indicator */}
      <div className={`connect-indicator${connectMode ? " active" : ""}`}>
        🔗 Connecting from <strong>{connectFromId ? (resources.find(r => r.id === connectFromId)?.name || "…") : "…"}</strong> — click a target resource
        <button className="connect-cancel-btn" onClick={cancelConnect}>Cancel (Esc)</button>
      </div>

      {/* Transform container */}
      <div
        className="cv-transform"
        ref={transformRef}
        onMouseDown={onPanStart}
        onWheel={onWheel}
      >
        <div
          className="cv-viewport"
          ref={viewportRef}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* Subnet zones — rendered conditionally based on resource presence */}
          {hasPublic && (
            <div className="subnet pub" style={{ left: pubZone.left, top: pubZone.top, width: pubZone.width, height: pubZone.height }}>
              <div className="subnet-label">Public Subnet</div>
            </div>
          )}
          {hasPrivate && (
            <div className="subnet prv" style={{ left: prvZone.left, top: prvZone.top, width: prvZone.width, height: prvZone.height }}>
              <div className="subnet-label">Private Subnet</div>
            </div>
          )}
          {hasGlobal && (
            <div className="subnet global" style={{ left: globalZone.left, top: globalZone.top, width: globalZone.width, height: globalZone.height }}>
              <div className="subnet-label">Global / Regional Services</div>
            </div>
          )}

          {/* Application groups */}
          {(appGroups || []).map(g => {
            const members = resources.filter(r => g.resource_ids && g.resource_ids.includes(r.id))
            if (members.length === 0) return null
            const bounds = zoneBounds(members, null)
            if (!bounds) return null
            return (
              <div key={g.id} className="app-group" style={{
                position: "absolute",
                left: bounds.left - 6, top: bounds.top - 6,
                width: bounds.width + 12, height: bounds.height + 12,
                border: `2px dashed ${g.color || "var(--accent-cyan)"}`,
                borderRadius: 8,
                pointerEvents: "none",
                zIndex: 1
              }}>
                <div style={{
                  position: "absolute", top: -18, left: 8,
                  fontSize: 10, fontWeight: 600,
                  color: g.color || "var(--accent-cyan)",
                  background: "var(--bg-body, #0a0e1a)",
                  padding: "0 4px"
                }}>{g.name}</div>
              </div>
            )
          })}

          {/* SVG connections */}
          <svg className="conn-svg" ref={svgRef} style={{ width: "100%", height: "100%" }} />

          {/* Resource blocks */}
          <div ref={blocksRef}>
            {resources.map(r => {
              const cat = catFor(r.module_definition.category)
              const errCount = (r.validation_errors || []).length
              return (
                <div
                  key={r.id}
                  data-rid={r.id}
                  className={`rb${r.id === selectedId ? " selected" : ""}${r.id === connectFromId ? " connecting" : ""}`}
                  style={{ left: `${r.position_x || 50}px`, top: `${r.position_y || 50}px` }}
                  onMouseDown={e => onBlockMouseDown(e, r)}
                  onClick={e => onBlockClick(e, r)}
                >
                  <div className="rb-i" style={{ background: cat.bg, color: cat.color }}>
                    {r.module_definition.icon}
                  </div>
                  <div>
                    <div className="rb-n">{r.name}</div>
                    <div className="rb-t">{r.module_definition.display_name}</div>
                  </div>
                  {errCount > 0 && <div className="rb-badge" style={{ background: "var(--accent-red)" }}>!</div>}
                  {r.upgrade_available && <div className="rb-badge rb-upgrade-badge" title="Upgrade available" style={{ background: "var(--orange)", right: errCount > 0 ? 22 : 4 }}>↑</div>}
                </div>
              )
            })}
          </div>

          {/* Empty state */}
          {resources.length === 0 && (
            <div className="cv-empty">
              <p>Drag a module from the catalog to add it to the canvas</p>
            </div>
          )}

          {/* Smart placement callout */}
          {resources.length > 0 && (
            <div className="callout" style={{ right: 20, bottom: 40 }}>
              <strong>💡 Smart placement</strong>
              RDS auto-placed in private subnet. Databases cannot be in public subnets per your business rules.
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="zoom-ctrl">
        <button className="zc-btn" onClick={() => setZoom(zoom - 0.1)}>−</button>
        <div className="zoom-level">{Math.round(zoom * 100)}%</div>
        <button className="zc-btn" onClick={() => setZoom(zoom + 0.1)}>+</button>
        <button className="zc-btn" title="Fit all" onClick={fitAll}>⤢</button>
      </div>

      {/* Minimap */}
      <Minimap resources={resources} zoom={zoom} pan={pan} setPan={setPan} transformRef={transformRef} />
    </div>
  )
}

function Minimap({ resources, zoom, pan, setPan, transformRef }) {
  const mmW = 168, mmH = 96
  const mmCanvasRef = useRef(null)

  // Compute which zones have resources
  const zoneFlags = useMemo(() => {
    const flags = { public: false, private: false, global: false }
    resources.forEach(r => {
      if (r.zone && flags.hasOwnProperty(r.zone)) flags[r.zone] = true
    })
    return flags
  }, [resources])

  // Compute layout metrics (safe defaults when empty)
  const { maxX, maxY, scaleX, scaleY } = useMemo(() => {
    let mx = 800, my = 500
    resources.forEach(r => {
      mx = Math.max(mx, (r.position_x || 0) + 150)
      my = Math.max(my, (r.position_y || 0) + 50)
    })
    return { maxX: mx, maxY: my, scaleX: mmW / mx, scaleY: mmH / my }
  }, [resources])

  // Convert a minimap pixel position to canvas pan coordinates
  const mmToPan = useCallback((mmX, mmY) => {
    const tRect = transformRef.current?.getBoundingClientRect()
    const canvasX = mmX / scaleX
    const canvasY = mmY / scaleY
    const viewW = tRect ? tRect.width / zoom : 800
    const viewH = tRect ? tRect.height / zoom : 500
    return {
      x: -(canvasX - viewW / 2) * zoom,
      y: -(canvasY - viewH / 2) * zoom
    }
  }, [scaleX, scaleY, zoom, transformRef])

  // Click on minimap to jump to that position
  const onMinimapMouseDown = useCallback((e) => {
    const rect = mmCanvasRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()

    const update = (ev) => {
      const mx = Math.max(0, Math.min(mmW, ev.clientX - rect.left))
      const my = Math.max(0, Math.min(mmH, ev.clientY - rect.top))
      setPan(mmToPan(mx, my))
    }

    // Immediate jump
    update(e)

    // Drag to pan
    const onMove = (ev) => update(ev)
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [mmToPan, setPan])

  // All hooks above — safe to early-return now
  if (resources.length === 0) return (
    <div className="minimap">
      <div className="mm-label">Minimap</div>
      <div className="mm-canvas">
        <div className="mm-zone pub" /><div className="mm-zone prv" /><div className="mm-zone global" />
      </div>
    </div>
  )

  const hasPublic = zoneFlags.public
  const hasPrivate = zoneFlags.private
  const hasGlobal = zoneFlags.global

  const tRect = transformRef.current?.getBoundingClientRect()
  const vpW = tRect ? (tRect.width / zoom) * scaleX : mmW
  const vpH = tRect ? (tRect.height / zoom) * scaleY : mmH
  const vpX = (-pan.x / zoom) * scaleX
  const vpY = (-pan.y / zoom) * scaleY

  return (
    <div className="minimap">
      <div className="mm-label">Minimap · {resources.length} resources</div>
      <div className="mm-canvas" ref={mmCanvasRef} onMouseDown={onMinimapMouseDown} style={{ cursor: "pointer" }}>
        {hasPublic && <div className="mm-zone pub" />}
        {hasPrivate && <div className="mm-zone prv" />}
        {hasGlobal && <div className="mm-zone global" />}
        {resources.map(r => {
          const cat = catFor(r.module_definition.category)
          return (
            <div key={r.id} className="mm-block" style={{
              left: (r.position_x || 0) * scaleX,
              top: (r.position_y || 0) * scaleY,
              background: cat.color
            }} />
          )
        })}
        <div className="mm-viewport" style={{
          left: Math.max(0, vpX), top: Math.max(0, vpY),
          width: Math.min(mmW, vpW), height: Math.min(mmH, vpH),
          pointerEvents: "none"
        }} />
      </div>
    </div>
  )
}

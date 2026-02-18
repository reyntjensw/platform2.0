import React, { useState, useRef, useEffect, useCallback } from "react"
import { catFor } from "./constants"

const GROUP_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#bc8cff", "#39d2c0", "#f778ba", "#79c0ff"]

export default function CommandPalette({
  resources, catalogModules, onClose, onSelectResource, onAddModule,
  appGroups, onSelectGroup, onCreateGroup
}) {
  const [query, setQuery] = useState("")
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const q = query.toLowerCase().trim()

  const matchedResources = q
    ? resources.filter(r => r.name.toLowerCase().includes(q) || r.module_definition.display_name.toLowerCase().includes(q)).slice(0, 8)
    : resources.slice(0, 8)

  const matchedModules = q
    ? catalogModules.filter(m => (m.display_name || m.name || "").toLowerCase().includes(q)).slice(0, 5)
    : catalogModules.slice(0, 5)

  const matchedGroups = appGroups
    ? (q ? appGroups.filter(g => g.name.toLowerCase().includes(q)) : appGroups).slice(0, 5)
    : []

  // Show "create group" action when query doesn't exactly match an existing group
  const showCreateGroup = onCreateGroup && q.length > 0 && !appGroups?.some(g => g.name.toLowerCase() === q)

  const allItems = [
    ...matchedResources.map(r => ({ type: "resource", id: r.id, resource: r })),
    ...matchedGroups.map(g => ({ type: "group", id: g.id, group: g })),
    ...(showCreateGroup ? [{ type: "create-group", id: "__create_group__" }] : []),
    ...matchedModules.map(m => ({ type: "module", id: m.id, module: m }))
  ]

  const handleCreateGroup = useCallback(async () => {
    if (!q) return
    setCreatingGroup(true)
    const group = await onCreateGroup(q, newGroupColor)
    setCreatingGroup(false)
    if (group && onSelectGroup) {
      onSelectGroup(group.id)
      onClose()
    }
  }, [q, newGroupColor, onCreateGroup, onSelectGroup, onClose])

  const onKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, allItems.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault()
      const item = allItems[highlightIndex]
      if (item?.type === "resource") onSelectResource(item.id)
      else if (item?.type === "module") onAddModule(item.id)
      else if (item?.type === "group" && onSelectGroup) { onSelectGroup(item.id); onClose() }
      else if (item?.type === "create-group") handleCreateGroup()
    }
    else if (e.key === "Escape") onClose()
  }, [allItems, highlightIndex, onSelectResource, onAddModule, onSelectGroup, onClose, handleCreateGroup])

  return (
    <div className="cmd-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmd-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Search resources, modules, groups..."
          value={query}
          onChange={e => { setQuery(e.target.value); setHighlightIndex(-1) }}
          onKeyDown={onKeyDown}
        />
        <div className="cmd-results" ref={resultsRef}>
          {matchedResources.length > 0 && (
            <>
              <div className="cmd-section">Resources ({resources.length})</div>
              {matchedResources.map((r, i) => {
                const cat = catFor(r.module_definition.category)
                const idx = i
                return (
                  <div
                    key={r.id}
                    className={`cmd-item${idx === highlightIndex ? " highlighted" : ""}`}
                    onClick={() => onSelectResource(r.id)}
                  >
                    <div className="cmd-item-icon" style={{ background: cat.bg, color: cat.color }}>
                      {r.module_definition.icon || "?"}
                    </div>
                    <div className="cmd-item-name">{r.name}</div>
                    <div className="cmd-item-hint">{r.module_definition.display_name}</div>
                  </div>
                )
              })}
            </>
          )}

          {(matchedGroups.length > 0 || showCreateGroup) && (
            <>
              <div className="cmd-section">App Groups{appGroups?.length ? ` (${appGroups.length})` : ""}</div>
              {matchedGroups.map((g, i) => {
                const idx = matchedResources.length + i
                return (
                  <div
                    key={g.id}
                    className={`cmd-item${idx === highlightIndex ? " highlighted" : ""}`}
                    onClick={() => { if (onSelectGroup) { onSelectGroup(g.id); onClose() } }}
                  >
                    <div className="cmd-item-icon" style={{ background: g.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: g.color }} />
                    </div>
                    <div className="cmd-item-name">{g.name}</div>
                    <div className="cmd-item-hint">{resources.filter(r => r.application_group_id === g.id).length} resources</div>
                  </div>
                )
              })}
              {showCreateGroup && (() => {
                const idx = matchedResources.length + matchedGroups.length
                return (
                  <div
                    className={`cmd-item${idx === highlightIndex ? " highlighted" : ""}`}
                    onClick={handleCreateGroup}
                    style={{ opacity: creatingGroup ? 0.5 : 1 }}
                  >
                    <div className="cmd-item-icon" style={{ fontSize: 10 }}>+</div>
                    <div className="cmd-item-name" style={{ flex: 1 }}>
                      {creatingGroup ? "Creating…" : `Create group "${query.trim()}"`}
                    </div>
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      {GROUP_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setNewGroupColor(c) }}
                          style={{
                            width: 14, height: 14, borderRadius: 3, background: c, border: newGroupColor === c ? "2px solid #fff" : "2px solid transparent",
                            cursor: "pointer", padding: 0, flexShrink: 0
                          }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )}

          {matchedModules.length > 0 && (
            <>
              <div className="cmd-section">{q ? "Add Module" : "Quick Add"}</div>
              {matchedModules.map((m, i) => {
                const idx = matchedResources.length + matchedGroups.length + (showCreateGroup ? 1 : 0) + i
                return (
                  <div
                    key={m.id}
                    className={`cmd-item${idx === highlightIndex ? " highlighted" : ""}`}
                    onClick={() => onAddModule(m.id)}
                  >
                    <div className="cmd-item-icon" style={{ fontSize: 10 }}>+</div>
                    <div className="cmd-item-name">Add {m.display_name || m.name}</div>
                    <div className="cmd-item-hint">{m.category}</div>
                  </div>
                )
              })}
            </>
          )}
          {allItems.length === 0 && (
            <div className="cmd-empty">No results for "{query}"</div>
          )}
        </div>
      </div>
    </div>
  )
}

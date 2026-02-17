import React, { useState, useRef, useEffect, useCallback } from "react"
import { catFor } from "./constants"

export default function CommandPalette({ resources, catalogModules, onClose, onSelectResource, onAddModule }) {
  const [query, setQuery] = useState("")
  const [highlightIndex, setHighlightIndex] = useState(-1)
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

  const allItems = [
    ...matchedResources.map(r => ({ type: "resource", id: r.id, resource: r })),
    ...matchedModules.map(m => ({ type: "module", id: m.id, module: m }))
  ]

  const onKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, allItems.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault()
      const item = allItems[highlightIndex]
      if (item?.type === "resource") onSelectResource(item.id)
      else if (item?.type === "module") onAddModule(item.id)
    }
    else if (e.key === "Escape") onClose()
  }, [allItems, highlightIndex, onSelectResource, onAddModule, onClose])

  return (
    <div className="cmd-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmd-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Search resources, modules, actions..."
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
          {matchedModules.length > 0 && (
            <>
              <div className="cmd-section">{q ? "Add Module" : "Quick Add"}</div>
              {matchedModules.map((m, i) => {
                const idx = matchedResources.length + i
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

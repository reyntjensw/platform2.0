import React, { useState, useMemo } from "react"

const ZONE_BADGES = {
  public:  { label: "Pub", className: "zone-badge pub" },
  private: { label: "Prv", className: "zone-badge prv" },
  global:  { label: "Gbl", className: "zone-badge global" },
}

export default function CatalogPanel({ modules, cloudFilter, setCloudFilter, onAddResource }) {
  const [search, setSearch] = useState("")

  const providers = useMemo(() => [...new Set(modules.map(m => m.cloud_provider))].sort(), [modules])

  const grouped = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = modules.filter(m => {
      const matchQ = !q || m.display_name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
      const matchCloud = !cloudFilter || m.cloud_provider === cloudFilter
      return matchQ && matchCloud
    })
    const groups = {}
    filtered.forEach(m => {
      if (!groups[m.category]) groups[m.category] = []
      groups[m.category].push(m)
    })
    return groups
  }, [modules, search, cloudFilter])

  const toggleCloud = (provider) => {
    setCloudFilter(cloudFilter === provider ? null : provider)
  }

  const onDragStart = (e, mod) => {
    e.dataTransfer.setData("text/plain", mod.id)
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div className="catalog-panel">
      <div className="catalog-header">
        <h3>Module Catalog</h3>
        <input
          className="search-input"
          placeholder="Search modules..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="cloud-toggle">
          {providers.map(p => (
            <button
              key={p}
              className={`cloud-chip ${cloudFilter === p ? (p === "aws" ? "aws-on" : "azure-on") : ""}`}
              onClick={() => toggleCloud(p)}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="catalog-modules">
        {Object.entries(grouped).map(([category, mods]) => (
          <React.Fragment key={category}>
            <div className="cat-title">{category.charAt(0).toUpperCase() + category.slice(1)}</div>
            {mods.map(mod => (
              <div
                key={mod.id}
                className="mod-item"
                draggable
                onDragStart={e => onDragStart(e, mod)}
                onClick={() => onAddResource(mod.id)}
              >
                <div className={`mod-icon ${mod.category}`}>{mod.icon}</div>
                <div>
                  <div className="mod-name">{mod.display_name}</div>
                  <div className="mod-desc">{mod.description || category.charAt(0).toUpperCase() + category.slice(1)}</div>
                </div>
                <div className="mod-zones">
                  {(mod.allowed_zones || []).map(z => (
                    <span key={z} className={ZONE_BADGES[z]?.className}>{ZONE_BADGES[z]?.label}</span>
                  ))}
                </div>
                <div className="engine-dots"><i className="tf"></i></div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

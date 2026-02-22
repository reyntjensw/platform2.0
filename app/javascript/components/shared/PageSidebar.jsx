/**
 * PageSidebar — Reusable left sidebar for page-level navigation.
 *
 * Props:
 *   sections: Array of { label: string, items: Array<SidebarItem> }
 *   activeId: string — currently active item id
 *   onNavigate: (id: string) => void
 *
 * SidebarItem shape:
 *   { id, label, icon: ReactNode, count?: number, alert?: boolean }
 */
export default function PageSidebar({ sections, activeId, onNavigate }) {
  return (
    <aside className="page-sidebar" role="navigation" aria-label="Page navigation">
      {sections.map((section, si) => (
        <div key={si} className="page-sidebar-section">
          {section.label && (
            <div className="page-sidebar-section-label">{section.label}</div>
          )}
          {section.items.map((item) => {
            const isActive = activeId === item.id
            const cls = [
              'page-sidebar-item',
              isActive ? 'active' : '',
              item.alert ? 'alert' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                key={item.id}
                className={cls}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon && <span className="page-sidebar-icon">{item.icon}</span>}
                <span className="page-sidebar-label">{item.label}</span>
                {item.count != null && (
                  <span className="page-sidebar-count">{item.count}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

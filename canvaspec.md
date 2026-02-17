# Canvas Views System — Comprehensive Implementation Spec

## Overview
Implement the complete canvas views system for Factor Fifty: the three-panel layout (group sidebar + canvas + right panel), four view types (Group View, All Resources, Bird's Eye, Custom Views), ghost blocks for cross-group dependencies, minimap, command palette, and full resource interaction (drag, connect, select, edit). This spec covers every UI element, backend API, Stimulus controller, Turbo Frame endpoint, and CSS class needed to ship the canvas.

The backend (models, API endpoints, authentication, module system) is already in place. This spec focuses entirely on the frontend implementation and the Rails view layer.

## Architecture References
- Mockup: factorfifty-canvas-at-scale.html (4 screens: Compute Group, Data Group, All Resources, Bird's Eye)
- Architecture: factorfifty-architecture.html (Section 7: Canvas & Frontend Architecture)
- Addendum: factorfifty-architecture-addendum-v2.html (Sections A8-A10: Canvas Views System)
- Prototype: factorfifty-prototype.jsx (working React prototype with drag-drop, validation)

## Tech Stack
- **Rails 8** with Hotwire (Turbo Frames, Turbo Streams, Stimulus)
- **Stimulus controllers** for all canvas interactivity (drag, pan, zoom, connect, select)
- **SVG** for connection lines (rendered in an overlay `<svg>` element covering the canvas)
- **Turbo Frames** for right panel content (server-rendered HTML, swapped on selection change)
- **JSON API** for resource CRUD (position updates, config changes, connection management)
- **CSS custom properties** from the F50 design system (no Tailwind — matches the mockup exactly)
- **No React** — the production canvas uses Stimulus + server-rendered HTML, not the React prototype

---

## Requirement 1: Application Shell & Three-Panel Layout

### Description
The environment page renders the full application shell: top bar, left sidebar (two sections: app-nav + canvas groups), center canvas area, and right panel. The layout uses CSS Grid and fills the viewport (100vh, no scroll on body).

### Visual Specification (from mockup)

```
┌─────────────────────────────────────────────────────────────────────┐
│ TOPBAR (48px height, --bg2, border-bottom: 1px --border)           │
│ [Logo] F50  Immovlan BV › Immovlan AWS › production     [Rules] [Promote] [▶ Deploy] [WD] │
└─────────────────────────────────────────────────────────────────────┘
┌────┬────────────────────────────────────────────────────┬───────────┐
│ 56 │                                                    │   280px   │
│ px │              CANVAS AREA                           │           │
│    │  ┌─group tabs bar (38px)─────────────────────┐     │  RIGHT    │
│ L  │  │[All(42)][Compute(8)][Data(6)][Net(12)]...│     │  PANEL    │
│ E  │  └──────────────────────────────────────────┘     │           │
│ F  │                                                    │  [Group]  │
│ T  │  ┌─ dot grid background ────────────────────┐     │  [Props]  │
│    │  │                                          │     │  [Valid]  │
│ S  │  │    [resource blocks]                     │     │           │
│ I  │  │    [ghost blocks]                        │     │  Content  │
│ D  │  │    [SVG connections]                     │     │  area     │
│ E  │  │    [subnet zones]                        │     │           │
│ B  │  │                                          │     │           │
│ A  │  └──────────────────────────────────────────┘     │           │
│ R  │                                                    │           │
│    │  [zoom: − 100% + ⤢]           [minimap 180×120]  │           │
└────┴────────────────────────────────────────────────────┴───────────┘
```

### CSS Specification

```css
/* Layout grid */
.app { display: flex; flex-direction: column; height: 100vh; }
.topbar { height: 48px; background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0 20px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
.main { flex: 1; display: grid; grid-template-columns: 56px 1fr 280px; overflow: hidden; }
.group-bar { background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 6px; justify-content: space-between; }
.canvas-area { position: relative; overflow: hidden; background: var(--bg); }
.rpanel { background: var(--bg2); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
```

### Acceptance Criteria
- [ ] Full-viewport layout with no body scroll, dark background (#080b12)
- [ ] Top bar: 48px, logo (5 vertical green bars animation), breadcrumb (Reseller › Customer › Project › Environment), right side: Rules button (ghost), Promote button (ghost), Deploy button (green), avatar
- [ ] Three-panel grid: 56px sidebar | flex canvas | 280px right panel
- [ ] Sidebar split into two sections: .gb-top (app nav) and .gb-bottom (canvas groups), separated by .gb-sep (1px line)
- [ ] Canvas area fills remaining space, position: relative for absolute-positioned children
- [ ] Right panel: tabs at top, scrollable body below
- [ ] All CSS custom properties from mockup :root applied
- [ ] Outfit font for all text, JetBrains Mono for code/values

### Tasks
1. Create `app/views/environments/show.html.erb` with the three-panel layout
2. Create `app/views/shared/_topbar.html.erb` with logo, breadcrumb, action buttons
3. Create `app/views/canvas/_sidebar.html.erb` with app-nav and group sections
4. Create `app/views/canvas/_right_panel.html.erb` with tab structure
5. Create `app/assets/stylesheets/canvas.css` with all layout CSS from mockup
6. Define all CSS custom properties in `:root` block matching mockup exactly
7. Import Outfit and JetBrains Mono fonts

---

## Requirement 2: Left Sidebar — App Navigation & Canvas Groups

### Description
The left sidebar (56px wide) has two sections. The top section contains app-level navigation icons (Canvas, FinOps, Security, Docs, Deploy, Drift). The bottom section contains canvas group buttons that switch which resources are visible. Both sections use the same 40×40px button style.

### Visual Specification

```
┌──────┐
│ APP NAV (top, scrolls with gb-top)
│  🎨  │  Canvas          ← active: green-dim bg, green left bar
│  💰  │  FinOps          ← orange badge "3" (top-right)
│  🛡  │  Security        ← red badge "2"
│  📄  │  Docs
│  🚀  │  Deploy
│  🔄  │  Drift
│ ──── │  (1px separator line, 24px wide, centered)
│
│ CANVAS GROUPS (bottom, only visible when Canvas app-nav is active)
│  ⊞   │  All             ← no color dot
│ ──── │
│  ⚡  │  Comp (8)        ← active: green-dim bg, green left bar, green label
│  🗄  │  Data (6)
│  🔗  │  Net (12)
│  📦  │  Store (8)
│  🔒  │  Sec (8)
│ ──── │
│  +   │  (dashed border button for adding custom group)
└──────┘
```

### CSS Specification

```css
.gb-btn, .gb-app { width: 40px; height: 40px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 3px; transition: all .15s; border: 1px solid transparent; position: relative; }
.gb-btn:hover, .gb-app:hover { background: var(--card-h); }
.gb-btn.active, .gb-app.active { background: var(--green-dim); border-color: rgba(46,204,113,.25); }
.gb-btn.active::before, .gb-app.active::before { content: ''; position: absolute; left: -6px; top: 50%; transform: translateY(-50%); width: 3px; height: 20px; background: var(--green); border-radius: 0 2px 2px 0; }
.gb-icon { font-size: 14px; margin-bottom: 1px; }
.gb-label { font-size: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: var(--t3); }
.gb-btn.active .gb-label { color: var(--green); }
.gb-app-badge { position: absolute; top: 2px; right: 2px; min-width: 12px; height: 12px; border-radius: 6px; background: var(--red); color: white; font-size: 7px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
.gb-app-badge.warn { background: var(--orange); }
.gb-sep { width: 24px; height: 1px; background: var(--border); margin: 6px auto; }
```

### Acceptance Criteria
- [ ] App-nav buttons: Canvas (🎨), FinOps (💰), Security (🛡), Docs (📄), Deploy (🚀), Drift (🔄)
- [ ] Canvas button active by default (green-dim background, green left bar pseudo-element)
- [ ] FinOps shows orange badge with savings recommendation count
- [ ] Security shows red badge with critical finding count
- [ ] Clicking a non-Canvas app-nav button replaces main content area (placeholder for Slice 6)
- [ ] Canvas groups section only visible when Canvas app-nav is active
- [ ] Group buttons show: emoji icon + uppercase label (6px) + resource count
- [ ] Active group button: green-dim background, green left bar, green label text
- [ ] "All" button (⊞) at top of groups, separated from category groups by .gb-sep
- [ ] "+" button at bottom with dashed border (border-style: dashed; border-color: var(--border))
- [ ] Clicking group button switches active view (updates canvas, tabs, right panel)
- [ ] Resource counts in group labels update via Turbo Stream when resources are added/removed
- [ ] Badge counts for FinOps/Security update via Turbo Stream

### Stimulus Controller: `sidebar_controller`

```javascript
// Handles app-nav switching and canvas group switching
// Targets: appNavButtons, groupButtons, canvasGroupsSection
// Actions: switchApp(event), switchGroup(event)
// Values: activeGroupValue (string), activeAppValue (string)
```

### Tasks
1. Create `app/views/canvas/_sidebar.html.erb` partial with both sections
2. Create `app/views/canvas/_app_nav.html.erb` partial for app-level buttons
3. Create `app/views/canvas/_group_nav.html.erb` partial for canvas group buttons
4. Create `app/javascript/controllers/sidebar_controller.js`
5. Implement switchGroup action: updates active state, dispatches custom event for canvas filtering
6. Implement switchApp action: replaces main content area, hides/shows group section
7. Add Turbo Stream targets for resource counts and badge updates
8. Style with exact CSS from mockup

---

## Requirement 3: Group Tabs Bar (Horizontal, Above Canvas)

### Description
A horizontal tab bar above the canvas area provides alternative group navigation. Each tab shows: colored dot (6px circle matching group color) + group name + count badge. The active tab has green text, green underline (via border-bottom trick), and a card-like background. A "+" button at the end creates custom groups.

### Visual Specification

```
┌──────────────────────────────────────────────────────────────────┐
│ [•All(42)] [•Compute(8)] [•Data(6)] [•Net(12)] [•Store(8)] [+] │
│   gray       ACTIVE        gray       gray       gray          │
│             (green text,                                        │
│              --bg fill,                                         │
│              border on                                          │
│              3 sides,                                           │
│              border-bottom                                      │
│              matches --bg                                       │
│              to "sit on"                                        │
│              the canvas)                                        │
└──────────────────────────────────────────────────────────────────┘
```

### CSS Specification

```css
.group-tabs { position: absolute; top: 0; left: 0; right: 0; height: 38px; background: var(--bg2); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 10px; z-index: 20; gap: 2px; }
.gt-tab { padding: 6px 14px; font-size: 10px; font-weight: 600; color: var(--t3); cursor: pointer; border-radius: 6px 6px 0 0; display: flex; align-items: center; gap: 5px; transition: all .15s; border: 1px solid transparent; border-bottom: none; position: relative; }
.gt-tab:hover { color: var(--t1); background: var(--card); }
.gt-tab.active { color: var(--green); background: var(--bg); border-color: var(--border); border-bottom: 1px solid var(--bg); }
.gt-tab .gt-count { background: var(--bg3); padding: 1px 5px; border-radius: 8px; font-size: 8px; color: var(--t3); }
.gt-tab.active .gt-count { background: var(--green-dim); color: var(--green); }
.gt-tab .gt-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.gt-add { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--t3); font-size: 14px; border: 1px dashed var(--border); }
.gt-add:hover { color: var(--green); border-color: var(--green); }
```

### Acceptance Criteria
- [ ] Tab bar positioned absolute at top of canvas area, 38px height, z-index: 20
- [ ] All Resources tab: gray dot, "All Resources", count of ALL resources in env
- [ ] Category tabs: colored dot (cyan #1abc9c Compute, blue #3498db Data, purple #9b59b6 Networking, green #2ecc71 Storage, red #e74c3c Security) + name + count
- [ ] Custom group tabs appear after category tabs (if any exist)
- [ ] Active tab: green text, --bg background, 3-sided border (top, left, right), border-bottom matches canvas background to create "tab sits on canvas" effect
- [ ] Active tab count badge: green-dim background, green text
- [ ] "+" button at end: 28px square, dashed border, turns green on hover
- [ ] Tabs and sidebar group buttons stay in sync (clicking either updates both)
- [ ] Tabs are scrollable horizontally if too many groups (overflow-x: auto, hide scrollbar)
- [ ] Count updates via Turbo Stream when resources change

### Tasks
1. Create `app/views/canvas/_group_tabs.html.erb` partial
2. Render tabs from environment.canvas_views ordered by position
3. Sync tab clicks with sidebar group switching (dispatch same event)
4. Add Turbo Stream broadcast target for resource count updates
5. Add "+" tab button that opens custom group creation modal
6. Style with exact CSS matching mockup

---

## Requirement 4: Canvas Area — Grid, Zones, Resource Blocks

### Description
The main canvas area contains: a dot-grid background, subnet zones (Public/Private with dashed borders), resource blocks positioned absolutely at their (x,y) coordinates, and an SVG overlay for connection lines. Resources are draggable, selectable, and show validation badges.

### Visual Specification — Resource Block

```
┌─────────────────────────────────┐
│ [ICON]  resource-name           │  ← 8px border-radius, --card bg
│         Sub-type info           │     1.5px solid --border
│                            [●2] │  ← validation badge (top-right, 14px circle)
│     ↗ shared-services VPC       │  ← cross-env ref badge (bottom-center, purple)
└─────────────────────────────────┘

Icon: 22×22px, 5px border-radius, colored bg at 12% opacity
Name: 10px, weight 600, --t1
Sub-type: 7px, --t3
Badge: 14px circle, positioned top: -5px, right: -5px
```

### CSS Specification

```css
/* Background grid */
.canvas-grid { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(30,42,61,.4) 1px, transparent 1px); background-size: 20px 20px; opacity: .3; }

/* Subnet zones */
.zone { position: absolute; border: 2px dashed; border-radius: 14px; }
.zone.pub { border-color: rgba(46,204,113,.2); background: rgba(46,204,113,.012); }
.zone.prv { border-color: rgba(52,152,219,.2); background: rgba(52,152,219,.012); }
.zone-label { position: absolute; top: -9px; left: 12px; background: var(--bg); padding: 0 7px; font-size: 8px; font-weight: 700; border-radius: 2px; text-transform: uppercase; letter-spacing: .5px; }
.zone.pub .zone-label { color: var(--green); }
.zone.prv .zone-label { color: var(--blue); }

/* Resource blocks */
.rb { position: absolute; background: var(--card); border: 1.5px solid var(--border); border-radius: 8px; padding: 7px 10px; display: flex; align-items: center; gap: 7px; cursor: pointer; transition: all .15s; z-index: 10; }
.rb:hover { border-color: var(--green); box-shadow: 0 0 0 1px var(--green), 0 4px 16px rgba(0,0,0,.3); }
.rb.selected { border-color: var(--green); box-shadow: 0 0 0 2px var(--green); }
.rb-i { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; flex-shrink: 0; }
.rb-n { font-size: 10px; font-weight: 600; white-space: nowrap; }
.rb-t { font-size: 7px; color: var(--t3); }
.rb-badge { position: absolute; top: -5px; right: -5px; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: white; }
.rb-xref { position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); background: var(--purple); color: white; font-size: 6px; font-weight: 700; padding: 1px 5px; border-radius: 6px; white-space: nowrap; }

/* Ghost blocks */
.rb-ghost { opacity: .35; border-style: dashed; }
.rb-ghost:hover { opacity: .7; }

/* SVG connections */
.conn-svg { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.conn-line { stroke: var(--border-l); stroke-width: 1.5; fill: none; }
.ghost-line { stroke: var(--purple); stroke-width: 1.5; stroke-dasharray: 6 4; opacity: .4; }
```

### Acceptance Criteria
- [ ] Dot grid renders as radial-gradient at 20px intervals, opacity 0.3
- [ ] Subnet zones positioned within the canvas, zones from environment config
- [ ] Public zone: green dashed border, "PUBLIC SUBNET" label in green
- [ ] Private zone: blue dashed border, "PRIVATE SUBNET" label in blue
- [ ] Resource blocks rendered at their (position_x, position_y) as position: absolute within canvas
- [ ] Block shows: module icon (colored bg at 12% opacity, 3-letter abbreviation), resource name (10px bold), sub-type info (7px, gray)
- [ ] Selected block: green border + 2px green box-shadow
- [ ] Hover: green border + 1px green shadow + 16px dark shadow
- [ ] Validation badge: red circle with error count (if blocking errors), orange for warnings
- [ ] Cross-env reference badge: purple pill at bottom-center of block
- [ ] Ghost blocks: 35% opacity, dashed border, not draggable, show "in {Group} group" sub-type
- [ ] Ghost blocks hover to 70% opacity, click navigates to home group
- [ ] Ghost connection badges: purple pill labels "↓ used by EKS · click to jump to Data"
- [ ] SVG overlay covers entire canvas, pointer-events: none (click-through)
- [ ] Connection lines: bezier curves between connected blocks, --border-l color, 1.5px
- [ ] Ghost connection lines: purple, dashed (6 4 dasharray), 40% opacity
- [ ] Canvas can be panned (mousedown on empty space + drag), zoomed (scroll wheel or pinch)

### Stimulus Controller: `canvas_controller`

```javascript
// Main canvas controller managing all canvas interactions
// Targets: canvas, svgOverlay, blocks, ghostBlocks, zones
// Values: zoomValue (number, default 1.0), panXValue, panYValue, activeGroupValue, connectModeValue (boolean)
//
// Actions:
//   selectBlock(event)    — click block → set selected, load properties
//   deselectAll(event)    — click empty canvas → clear selection
//   startDrag(event)      — mousedown on block → initiate drag
//   drag(event)           — mousemove while dragging → update position
//   endDrag(event)        — mouseup → save position via PATCH
//   startConnect(event)   — click "Connect" → enter connect mode
//   completeConnect(event)— click second block → POST connection
//   cancelConnect(event)  — click empty space or Escape → exit connect mode
//   pan(event)            — mousedown on canvas bg → pan the viewport
//   zoom(event)           — wheel event or button click → scale transform
//   fitAll(event)         — ⤢ button → auto-zoom to fit all resources
//   navigateToGroup(event)— click ghost block → switch to ghost's home group
//
// Connection rendering:
//   After any position change or connection change, recalculate SVG paths
//   Bezier curve: M x1,y1 C x1+offset,y1 x2-offset,y2 x2,y2
//   Where offset = |x2-x1| * 0.4 (control point horizontal offset)
```

### Tasks
1. Create `app/views/canvas/_canvas_area.html.erb` partial
2. Create `app/views/canvas/_resource_block.html.erb` partial (shared for real + ghost)
3. Create `app/views/canvas/_zone.html.erb` partial for subnet zones
4. Create `app/javascript/controllers/canvas_controller.js` — the main 400+ line controller
5. Implement block rendering: iterate resources, position at (x,y), apply module icon colors
6. Implement drag-and-drop: mousedown/move/up lifecycle with position patch
7. Implement selection: click block → add .selected class, dispatch event for right panel
8. Implement SVG connection rendering: calculate bezier paths between connected blocks
9. Implement ghost block rendering: filter resources not in current group but connected to it
10. Implement ghost connection badges as positioned divs
11. Implement pan: mousedown on canvas background → translate all children
12. Implement zoom: wheel event → CSS transform: scale() on canvas container
13. Implement fit-all: calculate bounding box of all resources → set zoom + pan to fit
14. Implement connect mode: visual indicator, cursor change, click-to-connect flow
15. Style everything with exact CSS from mockup

---

## Requirement 5: Ghost Block System

### Description
When viewing a group, resources from other groups that have connections to resources in the current group appear as ghost blocks. These are computed client-side from the resources and connections data.

### Ghost Block Resolution Algorithm

```
Given:
  currentGroup = the active canvas view
  allResources = all resources in the environment
  allConnections = all connections in the environment

1. Get resourcesInGroup = resources with membership in currentGroup
2. Get resourceIdsInGroup = set of IDs
3. For each connection in allConnections:
     if connection.from_resource_id IN resourceIdsInGroup
       AND connection.to_resource_id NOT IN resourceIdsInGroup:
         Add to_resource as ghost (consumed by this group)
     if connection.to_resource_id IN resourceIdsInGroup
       AND connection.from_resource_id NOT IN resourceIdsInGroup:
         Add from_resource as ghost (provides to this group)
4. Deduplicate ghosts
5. Position ghosts below the zone area (y = zone_bottom + 20px, spread horizontally)
6. Draw dashed connection lines from ghost to connected real resource
```

### Acceptance Criteria
- [ ] Ghost blocks only appear in group views (NOT in All Resources view)
- [ ] Ghost blocks show for resources connected to (incoming or outgoing) this group's resources
- [ ] Visual: 35% opacity, dashed border, lighter text, module icon at reduced opacity
- [ ] Label: "{module_icon} {resource_name}" on first line, "in {group_name} group" on second line in --t3 color
- [ ] Ghost connection badge: purple pill positioned between ghost and its connected real resource
  - Text: "↓ used by {resource_name} · click to jump to {group_name}"
  - Clickable: navigates to the ghost resource's home group
- [ ] Hover: opacity increases to 70%, cursor pointer
- [ ] Click: navigates to ghost's home group AND selects the ghost resource in that group
- [ ] Ghost blocks are NOT draggable, NOT editable, NOT selectable for properties
- [ ] Ghost connection lines: purple (#9b59b6), dashed (stroke-dasharray: 6 4), 40% opacity
- [ ] Ghosts positioned in a row below the main zone area, evenly spaced
- [ ] Ghost section has a subtle label: "↓ Ghost refs (other groups)" in --t3 color, 7px uppercase
- [ ] Right panel "Group" tab lists ghost refs in a separate section with "{group_name} →" link

### Tasks
1. Implement ghost resolution in canvas_controller.js (client-side filtering)
2. Create ghost block rendering (reuse _resource_block partial with ghost: true flag)
3. Implement ghost positioning algorithm (row below zones, spaced evenly)
4. Create ghost connection badge partial
5. Implement ghost click → group navigation + resource selection
6. Draw dashed SVG connection lines for ghost connections
7. Add ghost ref list to right panel Group tab
8. Ensure ghosts are excluded from All Resources view

---

## Requirement 6: Right Panel — Three Tabs (Group, Props, Valid)

### Description
The right panel (280px wide) has three tabs that switch content. The Group tab shows group info and resource list. The Props tab shows properties for the selected resource (Turbo Frame). The Valid tab shows validation results.

### Tab Specification

```
GROUP TAB (active when a group is selected, no resource selected)
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ [●] Compute Group               │ │  ← group-info card (--bg3 bg, rounded)
│ │ EKS clusters, ECS services...   │ │     10px dot matching group color
│ │ ┌───────────────────────────┐   │ │
│ │ │ 8 resources │ 3 ghosts │0e│  │ │  ← stat row
│ │ └───────────────────────────┘   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ RESOURCES IN THIS GROUP             │  ← section header (7px uppercase)
│ [EKS] platform-eks     EKS 1.29    │  ← res-list-item, click to select
│ [NG]  ng-general        m6i.xlarge  │
│ [NG]  ng-spot            spot       │
│ [ALB] app-alb            ALB        │
│ ...                                 │
│                                     │
│ GHOST REFS (OTHER GROUPS)           │  ← section header
│ [RDS] app-postgres      Data →      │  ← ghost item, click to jump
│ [EC]  redis-cache        Data →     │
│ [S3]  media-bucket       Storage →  │
└─────────────────────────────────────┘

PROPS TAB (active when a resource is selected)
┌─────────────────────────────────────┐
│ ┌─ Turbo Frame ─────────────────┐  │
│ │ platform-eks                  │  │  ← resource name, editable
│ │ EKS Cluster                   │  │  ← module display name, gray
│ │                               │  │
│ │ CLUSTER CONFIG                │  │  ← field group header (7px uppercase)
│ │ Version     [1.30 ▼]         │  │  ← select field
│ │ Instance    [m6i.xlarge ▼]   │  │
│ │ Min Nodes   [- 3 +]         │  │  ← number with stepper
│ │ Max Nodes   [- 12 +]        │  │
│ │                               │  │
│ │ ADD-ONS                       │  │
│ │ Karpenter   [●━━━ ON]       │  │  ← toggle
│ │ ALB Ctrl    [●━━━ ON]       │  │
│ │                               │  │
│ │ DEPENDENCIES                  │  │
│ │ vpc_id      ← shared.vpc ✓  │  │  ← resolved dependency (green ✓)
│ │ subnet_ids  ← shared.vpc ✓  │  │
│ │                               │  │
│ │ [Save]  [Delete]  [Connect]  │  │
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘

VALID TAB (validation results)
┌─────────────────────────────────────┐
│ ┌─ Error ───────────────────────┐  │  ← vi.err: red left border (2px)
│ │ Encryption at rest required   │  │     rgba(231,76,60,.04) background
│ │ analytics-db · Data group     │  │
│ └───────────────────────────────┘  │
│ ┌─ Warning ─────────────────────┐  │  ← vi.wrn: orange left border
│ │ Single-AZ RDS                 │  │     rgba(243,156,18,.04) background
│ │ analytics-db · Data group     │  │
│ └───────────────────────────────┘  │
│ ┌─ OK ──────────────────────────┐  │  ← vi.ok: green left border
│ │ 39 resources OK               │  │     rgba(46,204,113,.04) background
│ └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### CSS Specification

```css
.rp-tabs { display: flex; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.rp-tab { flex: 1; padding: 8px; font-size: 8px; font-weight: 700; text-align: center; color: var(--t3); cursor: pointer; border-bottom: 2px solid transparent; text-transform: uppercase; letter-spacing: .5px; }
.rp-tab.active { color: var(--green); border-bottom-color: var(--green); }
.rp-body { flex: 1; overflow-y: auto; padding: 12px; }
.rp-section { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--t3); margin: 12px 0 5px; }
.group-info { background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.gi-title { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.gi-desc { font-size: 10px; color: var(--t2); line-height: 1.4; margin-bottom: 8px; }
.gi-stat { display: flex; gap: 12px; }
.gi-stat-item { font-size: 10px; color: var(--t3); }
.gi-stat-item strong { color: var(--t1); display: block; font-size: 14px; }
.res-list-item { display: flex; align-items: center; gap: 7px; padding: 5px 6px; border-radius: 6px; cursor: pointer; margin-bottom: 1px; transition: background .1s; }
.res-list-item:hover { background: var(--card-h); }
.res-list-item.active { background: var(--green-dim); }
.rli-i { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 700; flex-shrink: 0; }
.rli-name { font-size: 10px; font-weight: 600; flex: 1; }
.rli-type { font-size: 8px; color: var(--t3); }
.rli-ghost { font-size: 7px; color: var(--purple); font-weight: 600; }
.vi { display: flex; gap: 5px; padding: 5px 7px; border-radius: 5px; margin-bottom: 3px; font-size: 9px; line-height: 1.3; }
.vi.err { background: rgba(231,76,60,.04); border-left: 2px solid var(--red); }
.vi.wrn { background: rgba(243,156,18,.04); border-left: 2px solid var(--orange); }
.vi.ok { background: rgba(46,204,113,.04); border-left: 2px solid var(--green); }
```

### Acceptance Criteria
- [ ] Tab bar: 3 tabs (Group/Props/Valid), active tab has green text + green bottom border
- [ ] Group tab renders: group-info card (color dot, name, description, stat row), resource list, ghost refs list
- [ ] Resource list items: module icon (18px, colored), name (10px bold), type hint (8px gray)
- [ ] Active resource in list: green-dim background
- [ ] Ghost items: name in --t3 color, purple "{group} →" link that navigates
- [ ] Props tab: Turbo Frame that loads server-rendered form for selected resource
- [ ] Props Turbo Frame src: `/resources/{id}/properties` (GET returns HTML partial)
- [ ] Props form renders fields dynamically from ModuleField definitions grouped by .group
- [ ] Field types: text input, number with stepper buttons, select dropdown, toggle switch
- [ ] Dependency fields: read-only with "← {source}.{output} ✓" or "Not connected ⚠" indicator
- [ ] Platform-managed fields: hidden or read-only section (collapsed by default)
- [ ] Save submits PATCH to resource API, Turbo Frame refreshes
- [ ] Delete button with confirmation dialog
- [ ] Connect button enters connect mode on canvas
- [ ] Valid tab: list of violations grouped by severity (errors first, then warnings, then OK)
- [ ] Violation items: severity color border-left, rule name (bold), affected resource + group
- [ ] Click violation → select that resource on canvas + switch to Props tab
- [ ] When no resource selected: Props tab shows "Select a resource to view properties"
- [ ] When no resource selected: Valid tab shows environment-wide validation summary
- [ ] Tab switching is instant (no server round-trip, just CSS display toggle)
- [ ] Tab content updates via Turbo Stream when data changes

### Turbo Frame Endpoints

```ruby
# Properties panel — server-rendered form
GET /resources/:id/properties → renders _properties.html.erb (Turbo Frame: "resource-properties")

# Validation panel — server-rendered list
GET /environments/:id/validations → renders _validations.html.erb (Turbo Frame: "validations")
GET /resources/:id/validations → renders _resource_validations.html.erb (Turbo Frame: "validations")
```

### Tasks
1. Create `app/views/canvas/_right_panel.html.erb` with tab structure
2. Create `app/views/canvas/_group_tab.html.erb` for Group tab content
3. Create `app/views/canvas/_resource_list.html.erb` for resource + ghost list
4. Create `app/views/resources/_properties.html.erb` Turbo Frame (the big one)
5. Create field type partials: `_text_field.html.erb`, `_number_field.html.erb`, `_select_field.html.erb`, `_toggle_field.html.erb`
6. Create `_dependency_field.html.erb` for resolved/unresolved dependency display
7. Create `app/views/canvas/_validations.html.erb` for Valid tab
8. Create `app/views/canvas/_violation_item.html.erb` partial
9. Create `app/javascript/controllers/right_panel_controller.js` for tab switching
10. Wire Turbo Frame for properties loading on resource selection
11. Wire Turbo Frame for validation loading
12. Implement click-violation → select-resource → switch-to-Props flow

---

## Requirement 7: All Resources View

### Description
Shows every resource in the environment at reduced zoom (60-70%). Resources are color-coded by their group. No ghost blocks (everything is visible). A color legend at the bottom maps group colors to names.

### Acceptance Criteria
- [ ] All resource blocks rendered, scaled to ~78% (transform: scale(.78), transform-origin: top left)
- [ ] Resource blocks show smaller icons (18×18px instead of 22×22px)
- [ ] Abbreviated resource names to save horizontal space
- [ ] Each resource block's icon color matches its group (cyan=Compute, blue=Data, purple=Net, green=Storage, red=Security)
- [ ] No ghost blocks in this view
- [ ] Both Public and Private subnet zones visible
- [ ] Zoom level indicator shows "60%" (auto-calculated to fit all resources)
- [ ] Color legend bar at bottom-left: 6px dots with group names (8px font, --t3 color)
  - Layout: `[●Compute] [●Data] [●Network] [●Storage] [●Security]`
  - Background: var(--bg2), border: 1px var(--border), border-radius: 6px, padding: 6px 10px
- [ ] Double-click any resource → navigates to that resource's primary group view and selects it
- [ ] Right panel switches to "Overview" tab showing: total count, error count, warning count, resources-by-group list

### Tasks
1. Create `app/views/canvas/_all_resources_view.html.erb` partial
2. Implement scaled rendering (reduce block size via CSS transform)
3. Create color legend component
4. Implement double-click to jump-to-group behavior
5. Create Overview tab content for right panel
6. Auto-calculate zoom to fit all resources in viewport

---

## Requirement 8: Bird's Eye View

### Description
Maximum zoom-out view where groups collapse into summary cards arranged in a grid. Each card shows: group color + name + resource count + dot-grid representing resources + health status. Clicking a card zooms into that group.

### Visual Specification (from mockup)

```
┌─────────────────────────────────────────────────────────────────┐
│  🦅 Bird's Eye View — click any group to zoom in               │ ← green info bar, centered
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ [●]Networking │  │ [●]Compute   │  │ [●]Security  │         │
│  │ 12            │  │ 8            │  │ 8            │         │
│  │ [■■■■■■■■■■■■]│  │ [■■■ ■■■ ■■]│  │ [■■■■■■■■]  │         │
│  │ VPC, subnets..│  │ EKS, ECS...  │  │ IAM, KMS...  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────────────────────┐  ┌──────────────┐            │
│  │ [●]Data                      │  │ [●]Storage   │            │
│  │ 6                            │  │ 8            │            │
│  │ [■■ ■■ ■■ ■■ ■■ ■■]        │  │ [■■■■■■■■]  │            │
│  │ RDS ×2, Redis, OpenSearch... │  │ S3 ×5, EFS..│            │
│  │                              │  │ ⚠ 1 error    │            │
│  └──────────────────────────────┘  └──────────────┘            │
│                                                                 │
│  ← Networking feeds into Compute & Data →                      │ ← cross-group flow hint
└─────────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Groups rendered as cards in a CSS Grid (3 columns, 16px gap)
- [ ] Card: --card background, 2px solid border in group color at 25% opacity, 14px border-radius, 16px padding
- [ ] Card header: 10px color dot + group name (12px bold) + count (9px gray, right-aligned)
- [ ] Card body: dot-grid of resource dots (8px squares, group color at 30-40% opacity), larger dots for "important" resources
- [ ] Card footer: description text (8px, --t3), health status if errors (8px, red)
- [ ] Cards with validation errors show: "⚠ {N} error: {brief description}" in red (8px)
- [ ] Click card → navigates to that group view
- [ ] Hover card: subtle border brightening
- [ ] Green info banner at top: "🦅 Bird's Eye View — click any group to zoom in"
- [ ] Cross-group flow description at bottom (8px, --t3)
- [ ] Right panel shows "Summary" tab: health overview, deploy status (version, engine, last deploy, drift status)
- [ ] Accessible via zoom-out beyond minimum (or ⤢ fit-all when already zoomed out)
- [ ] Also accessible via sidebar "All" button when holding Shift (or a dedicated bird's eye button)

### Tasks
1. Create `app/views/canvas/_birds_eye_view.html.erb` partial
2. Create group card component with dot-grid rendering
3. Calculate dot sizes: larger for "anchor" resources (EKS, RDS), standard for others
4. Implement card click → group navigation
5. Create green info banner component
6. Create Summary tab content for right panel
7. Wire bird's eye activation (zoom threshold or explicit button)

---

## Requirement 9: Minimap

### Description
A 180×120px widget in the bottom-right corner of the canvas showing the full environment as tiny colored dots with a draggable viewport rectangle.

### CSS Specification

```css
.minimap { position: absolute; bottom: 14px; right: 294px; width: 180px; height: 120px; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; z-index: 20; overflow: hidden; padding: 6px; }
.mm-label { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--t3); margin-bottom: 3px; }
.mm-canvas { width: 100%; height: calc(100% - 12px); background: var(--bg); border-radius: 4px; position: relative; overflow: hidden; }
.mm-zone.pub { left: 5%; top: 8%; width: 30%; height: 75%; border-color: rgba(46,204,113,.3); background: rgba(46,204,113,.03); }
.mm-zone.prv { left: 38%; top: 8%; width: 57%; height: 75%; border-color: rgba(52,152,219,.3); background: rgba(52,152,219,.03); }
.mm-block { position: absolute; width: 4px; height: 4px; border-radius: 1px; }
.mm-viewport { position: absolute; border: 1.5px solid var(--green); border-radius: 2px; background: rgba(46,204,113,.05); cursor: move; }
```

### Acceptance Criteria
- [ ] Positioned bottom-right, offset 14px from bottom and 294px from right (clearing the right panel)
- [ ] Label: "Minimap · {GroupName} ({groupCount}/{totalCount})" in 7px uppercase --t3
- [ ] Shows ALL resources as 4×4px colored dots (color = group color)
- [ ] Ghost blocks shown as dimmed dots (same color, opacity 30%)
- [ ] Subnet zones shown as faint bordered rectangles
- [ ] Green viewport rectangle shows current visible area of the canvas
- [ ] Dragging the viewport rectangle pans the main canvas in sync
- [ ] Clicking a position on the minimap (outside viewport) jumps the canvas to that location
- [ ] Minimap updates in real-time: resource dots move when blocks are dragged
- [ ] Click the label area to toggle collapse (minimap shrinks to just the label)
- [ ] Resource dot positions are proportionally scaled from canvas coordinates to minimap space

### Stimulus Controller: `minimap_controller`

```javascript
// Manages minimap rendering and viewport dragging
// Connected to canvas_controller via custom events
// On canvas pan/zoom: update viewport rectangle position/size
// On viewport drag: dispatch pan event to canvas_controller
// On resource move: update dot position
```

### Tasks
1. Create `app/views/canvas/_minimap.html.erb` partial
2. Create `app/javascript/controllers/minimap_controller.js`
3. Calculate proportional dot positions from canvas coordinates
4. Render viewport rectangle based on current canvas viewport
5. Implement viewport drag → canvas pan sync
6. Implement click-to-jump behavior
7. Implement collapse toggle
8. Connect to canvas_controller events for real-time updates

---

## Requirement 10: Command Palette (⌘K)

### Description
A quick-search overlay activated by ⌘K (macOS) or Ctrl+K that searches across all resources, groups, and actions. Results show instantly (client-side filtering).

### Visual Specification

```
┌─────────────────────────────────────────────┐
│  🔍 Search resources...             ⌘K     │ ← trigger button (above canvas, centered)
└─────────────────────────────────────────────┘

When activated:
┌─────────────────────────────────────────────┐
│  🔍 [postgres_________________________]    │ ← auto-focused input
├─────────────────────────────────────────────┤
│  RESOURCES                                  │
│  ▸ [RDS] app-postgres     Data group       │ ← highlighted result (--green-dim bg)
│    [RDS] analytics-db      Data group       │
│                                              │
│  GROUPS                                     │
│    [●] Data group          6 resources      │
│                                              │
│  ACTIONS                                    │
│    ▶  Deploy environment                    │
│    +  Add RDS PostgreSQL                    │
└─────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Trigger button positioned absolute above canvas, centered (top: 48px from group tabs), showing "🔍 Search resources... ⌘K"
- [ ] Trigger button style: --bg2 background, 1px --border, 8px border-radius, 11px font, --t3 color
- [ ] ⌘K (macOS) / Ctrl+K opens the palette overlay
- [ ] Overlay: centered modal, 500px wide max, --bg2 background, 8px border-radius, subtle shadow
- [ ] Search input: auto-focused, 13px font, no border (just bottom 1px divider)
- [ ] Results appear instantly (client-side fuzzy matching, no server round-trip)
- [ ] Result categories: Resources, Groups, Actions
- [ ] Resource results: module icon + resource name + group name
- [ ] Group results: colored dot + group name + resource count
- [ ] Action results: action icon + label (Deploy, Add {module_name})
- [ ] Arrow key navigation: up/down moves highlight, Enter selects
- [ ] Escape closes palette
- [ ] Selecting a resource: navigates to its group + selects it + opens Props tab
- [ ] Selecting a group: switches to that group view
- [ ] Selecting an action: executes it (deploy opens deploy panel, add module creates resource)
- [ ] Fuzzy matching: "post" matches "app-postgres", "rds" matches all RDS resources
- [ ] Empty state: "No results for '{query}'"
- [ ] Palette dismisses on click outside

### Stimulus Controller: `command_palette_controller`

```javascript
// Manages command palette overlay
// Targets: overlay, input, resultsList
// Values: openValue (boolean), highlightIndexValue (number)
// Actions: open(event), close(event), search(event), navigate(event), select(event)
// Data: preloaded from page (resources JSON, groups, available modules)
```

### Tasks
1. Create `app/views/canvas/_command_palette.html.erb` partial
2. Create `app/javascript/controllers/command_palette_controller.js`
3. Implement keyboard shortcut listener (⌘K / Ctrl+K)
4. Implement fuzzy search across resources, groups, and actions
5. Render categorized results with keyboard navigation
6. Implement result selection → canvas navigation
7. Implement action results (deploy, add module)
8. Style overlay and results matching F50 dark theme
9. Preload searchable data from page JSON (avoid server round-trips)

---

## Requirement 11: Zoom Controls & Environment Switcher

### Description
Zoom controls in the bottom-left and an environment type switcher in the top-right of the canvas area.

### Zoom Controls

```
[−] [100%] [+] [⤢]
```

- Position: absolute, bottom: 14px, left: 14px, z-index: 20
- Buttons: 30×30px, --bg2 bg, 1px --border, 6px border-radius
- Zoom level display: JetBrains Mono, 10px, --t3 color
- Zoom range: 30% to 200%
- ⤢ button: fit all resources in viewport

### Environment Switcher

```
[●dev] [●acc] [●prd]
```

- Position: absolute, top: 48px, right: 10px, z-index: 20
- Pill group: --bg2 bg, 1px --border, 6px border-radius, overflow hidden
- Each tab: 5px×5px colored dot + env name (9px, weight 600)
- Colors: dev=green, acc=orange, prd=red
- Active tab: colored text matching dot + subtle colored bg (rgba at 5%)
- Clicking switches environment (navigates to /environments/:other_id with same view context)

### Acceptance Criteria
- [ ] Zoom controls: −, level display, +, fit-all (⤢) — all styled per mockup
- [ ] Zoom via scroll wheel (with Ctrl held to avoid accidental zoom)
- [ ] Zoom via pinch gesture on trackpad
- [ ] Zoom level updates display in real-time
- [ ] Fit-all calculates bounding box and sets optimal zoom + pan
- [ ] Environment switcher shows all environments in the same project
- [ ] Active environment: colored text + dot matching env_type color
- [ ] Switching environment preserves current view (group, zoom, selection)

### Tasks
1. Create `app/views/canvas/_zoom_controls.html.erb`
2. Create `app/views/canvas/_env_switcher.html.erb`
3. Add zoom methods to canvas_controller.js (zoomIn, zoomOut, fitAll, setZoom)
4. Implement scroll-wheel zoom with Ctrl modifier
5. Implement pinch-to-zoom
6. Implement environment switching as Turbo navigation preserving view params

---

## Requirement 12: Custom Group Management

### Description
Users can create, rename, recolor, and delete custom canvas groups beyond the default category-based ones.

### Acceptance Criteria
- [ ] "+" button (sidebar and tab bar) opens a small modal/popover:
  - Name input (text, max 20 chars)
  - Color picker (preset palette of 8 colors or custom hex)
  - Icon input (emoji picker or text input)
  - "Create" button
- [ ] Custom groups appear after default groups in sidebar and tab bar
- [ ] Right-click resource → context menu: "Move to group…" (submenu listing all groups), "Also show in…" (adds to additional group)
- [ ] Drag resource from canvas to a group button in sidebar → moves to that group
- [ ] Right-click group button → "Rename", "Change color", "Delete"
- [ ] Delete custom group: resources return to their default category group
- [ ] Maximum 15 groups per environment (5 default + 10 custom)
- [ ] Group order is drag-reorderable in sidebar (custom groups only)

### Tasks
1. Create custom group creation modal/popover
2. Create color picker component (8 preset + custom hex)
3. Implement resource context menu with group management options
4. Implement drag-to-sidebar group reassignment
5. Implement group deletion with resource reassignment fallback
6. Implement group rename/recolor inline editing
7. Implement group reorder via sidebar drag
8. Enforce 15-group maximum

---

## Requirement 13: Canvas Data Loading & State Management

### Description
The canvas needs to load all resources, connections, canvas views, and module definitions for the current environment. This data powers the client-side rendering, ghost resolution, command palette search, and minimap.

### Data Loading Strategy

```ruby
# EnvironmentsController#show
# Loads all data needed for the canvas in a single page load

@environment = Environment.find(params[:id])
@resources = @environment.resources
  .includes(:module_definition, :canvas_view_memberships, :canvas_views)
  .to_json(include: {
    module_definition: { only: [:id, :name, :display_name, :icon, :category, :cloud_provider] },
    canvas_view_memberships: { only: [:canvas_view_id, :position_x, :position_y] }
  })
@connections = Connection.where(from_resource: @environment.resources).or(
  Connection.where(to_resource: @environment.resources)
).to_json
@canvas_views = @environment.canvas_views.order(:position).to_json
@validations = ValidationService.validate_environment(@environment).to_json
```

Data is embedded in the page as `data-*` attributes on the canvas controller element:

```erb
<div data-controller="canvas"
     data-canvas-resources-value="<%= @resources %>"
     data-canvas-connections-value="<%= @connections %>"
     data-canvas-views-value="<%= @canvas_views %>"
     data-canvas-validations-value="<%= @validations %>"
     data-canvas-active-view-value="<%= params[:view] || 'compute' %>">
```

### Real-Time Updates

- Resource position change → PATCH to API, optimistic update on client
- Resource config change → Turbo Frame refresh of properties panel
- Resource added/deleted → Turbo Stream appends/removes block + updates counts
- Connection added/deleted → client-side SVG redraw + ghost recalculation
- Validation change → Turbo Stream updates badge counts + validation panel

### Acceptance Criteria
- [ ] Single page load includes all data needed for canvas rendering
- [ ] No subsequent API calls needed for view switching (all client-side)
- [ ] Resources, connections, views, and validations passed as Stimulus values
- [ ] Real-time updates via Turbo Stream for add/remove operations
- [ ] Optimistic position updates (drag doesn't wait for server confirmation)
- [ ] Error handling: if PATCH fails, block snaps back to original position
- [ ] Loading state: show skeleton/spinner while initial data loads for very large environments

### Tasks
1. Update EnvironmentsController#show to preload all canvas data
2. Serialize resources with module definitions and view memberships
3. Serialize connections and canvas views
4. Embed data as Stimulus values on canvas controller element
5. Set up Turbo Stream channel for environment-level broadcasts
6. Implement optimistic updates for drag operations
7. Implement error rollback for failed position saves

---

## Requirement 14: Connection Drawing Interaction

### Description
Detailed specification for the connect mode UX: entering connect mode, visual feedback during connection, completing or canceling a connection.

### Connect Mode Flow

```
1. User clicks "Connect" button on selected resource (or in properties panel)
   → Canvas enters connect mode
   → Source block gets pulsing green border animation
   → Cursor changes to crosshair
   → Purple status bar appears: "🔗 Connect mode — click a target resource, or press Escape to cancel"

2. User moves mouse over canvas
   → Dashed preview line follows mouse from source block center to cursor
   → Valid targets get a subtle green tint on hover
   → Invalid targets (self, already connected) show red tint on hover

3. User clicks a valid target resource
   → POST /connections with from_resource_id and to_resource_id
   → Solid connection line rendered between blocks
   → Dependency auto-resolution triggered
   → Ghost blocks recalculated if cross-group
   → Connect mode exits automatically

4. User clicks empty canvas or presses Escape
   → Connect mode canceled
   → Preview line removed
   → All visual indicators cleared
```

### Acceptance Criteria
- [ ] Connect mode activated from: "Connect" button on selected block, or "Connect" button in properties panel
- [ ] Source block: pulsing green border (@keyframes pulse { 0%,100% { box-shadow: 0 0 0 2px var(--green); } 50% { box-shadow: 0 0 0 4px rgba(46,204,113,.3); } })
- [ ] Cursor: crosshair on canvas during connect mode
- [ ] Status bar: purple background, centered above canvas, shows connect mode instructions
- [ ] Preview line: dashed SVG line from source center to mouse position, purple color
- [ ] Valid target hover: green border tint
- [ ] Invalid target hover (self or duplicate): red border tint
- [ ] Connection creation triggers dependency resolution (server-side via callback)
- [ ] Cancel: Escape key or click on empty canvas
- [ ] After connection: ghost blocks update, SVG lines redraw, right panel refreshes

### Tasks
1. Add connect mode state to canvas_controller.js
2. Implement source block pulsing animation
3. Implement dashed preview line following mouse
4. Implement target validation (self-check, duplicate-check)
5. Implement visual feedback on valid/invalid hover
6. Create status bar for connect mode
7. POST connection on valid click, redraw SVG
8. Cancel on Escape or empty-canvas click
9. Trigger dependency resolution after connection creation

---

## Definition of Done

The canvas views system is complete when:

1. **Layout:** Three-panel layout renders correctly at 1280px+ with all CSS matching the mockup
2. **Sidebar:** App-nav (6 buttons with badges) and canvas groups (5 default + custom) with active indicators
3. **Group View:** Switching groups filters resources, shows ghost blocks, updates right panel
4. **All Resources:** Shows every resource at reduced scale, color-coded by group, with color legend
5. **Bird's Eye:** Groups as cards with dot-grids, clickable to zoom in, health badges
6. **Blocks:** Draggable resource blocks with module icons, validation badges, cross-env ref badges
7. **Ghost Blocks:** 35% opacity dashed blocks with purple badges, click-to-jump navigation
8. **Connections:** SVG bezier curves between blocks, dashed purple for ghost connections
9. **Connect Mode:** Full flow — enter, preview line, target validation, create, cancel
10. **Properties Panel:** Turbo Frame loads server-rendered form with all field types
11. **Validation Panel:** Violations listed by severity, click-to-navigate, environment summary
12. **Minimap:** Colored dots, draggable viewport, sync with canvas pan/zoom
13. **Command Palette:** ⌘K opens overlay, fuzzy search, keyboard nav, instant results
14. **Zoom:** −/+/fit-all buttons, scroll-wheel, pinch-to-zoom, level display
15. **Environment Switcher:** Switch environments preserving view context
16. **Custom Groups:** Create, rename, recolor, delete, drag resources between groups
17. **Real-time:** Turbo Stream updates for resource changes, validation changes, badge counts
18. **Performance:** Canvas renders 50 resources + 30 connections without visible lag
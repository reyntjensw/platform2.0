import { useState, useEffect, useCallback, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createDashboardApi, createWidgetApi, createCostApi } from './api'
import {
  useDashboards, useDashboard, useCreateDashboard, useUpdateDashboard, useDeleteDashboard,
  useCreateWidget, useUpdateWidget, useDeleteWidget, useReorderWidgets,
  useDistinctAccounts, useDistinctServices,
} from './hooks'
import DashboardSelector from './DashboardSelector'
import GlobalMonthSelector from './GlobalMonthSelector'
import AddWidgetModal, { CHART_TYPES } from './AddWidgetModal'
import CreateDashboardModal from './CreateDashboardModal'
import WidgetCard from './WidgetCard'

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1
const DEFAULT_PROVIDER = 'aws'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
})

function DashboardInner({ customerUuid, dashboardsApiUrl, costApiUrl, customerName }) {
  const dashboardApi = useMemo(() => createDashboardApi(dashboardsApiUrl), [dashboardsApiUrl])
  const widgetApi = useMemo(() => createWidgetApi(dashboardsApiUrl), [dashboardsApiUrl])
  const costApi = useMemo(() => createCostApi(costApiUrl, customerUuid), [costApiUrl, customerUuid])

  const { data: dashboards = [], isLoading: dashboardsLoading } = useDashboards(dashboardApi)
  const createDashboardMut = useCreateDashboard(dashboardApi)
  const updateDashboardMut = useUpdateDashboard(dashboardApi)
  const deleteDashboardMut = useDeleteDashboard(dashboardApi)
  const createWidgetMut = useCreateWidget(widgetApi)
  const updateWidgetMut = useUpdateWidget(widgetApi)
  const deleteWidgetMut = useDeleteWidget(widgetApi)
  const reorderWidgetsMut = useReorderWidgets(dashboardApi)

  const [currentDashboardId, setCurrentDashboardId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [draggedWidgetId, setDraggedWidgetId] = useState(null)
  const [dragOverWidgetId, setDragOverWidgetId] = useState(null)

  useEffect(() => {
    if (dashboards.length > 0 && !currentDashboardId) {
      const def = dashboards.find(d => d.is_default) || dashboards[0]
      setCurrentDashboardId(def.id)
    }
  }, [dashboards, currentDashboardId])

  const { data: currentDashboard, isLoading: dashboardLoading } = useDashboard(dashboardApi, currentDashboardId)

  const [globalMonth, setGlobalMonth] = useState(CURRENT_MONTH)
  const [globalYear, setGlobalYear] = useState(CURRENT_YEAR)

  useEffect(() => {
    if (currentDashboard?.layout_config) {
      setGlobalMonth(currentDashboard.layout_config.globalMonth || CURRENT_MONTH)
      setGlobalYear(currentDashboard.layout_config.globalYear || CURRENT_YEAR)
    }
  }, [currentDashboard])

  const { data: accountsData, isLoading: accountsLoading } = useDistinctAccounts(costApi, DEFAULT_PROVIDER)
  const { data: servicesData, isLoading: servicesLoading } = useDistinctServices(costApi, DEFAULT_PROVIDER)
  const accounts = accountsData?.accounts || []
  const services = servicesData?.services || []

  const selectDashboard = useCallback((id) => setCurrentDashboardId(id), [])

  const openCreateModal = useCallback(() => setShowCreateModal(true), [])

  const createDashboard = useCallback(async (name) => {
    const result = await createDashboardMut.mutateAsync({ name })
    setCurrentDashboardId(result.id)
    setShowCreateModal(false)
  }, [createDashboardMut])

  const renameDashboard = useCallback((id, name) => {
    updateDashboardMut.mutate({ id, name })
  }, [updateDashboardMut])

  const deleteDashboard = useCallback((id) => {
    if (dashboards.length <= 1) return
    deleteDashboardMut.mutate(id)
    if (currentDashboardId === id) {
      const remaining = dashboards.filter(d => d.id !== id)
      setCurrentDashboardId(remaining[0]?.id || null)
    }
  }, [deleteDashboardMut, dashboards, currentDashboardId])

  const handleMonthChange = useCallback((year, month) => {
    setGlobalYear(year)
    setGlobalMonth(month)
    if (currentDashboardId) {
      updateDashboardMut.mutate({ id: currentDashboardId, layout_config: { globalMonth: month, globalYear: year } })
    }
  }, [currentDashboardId, updateDashboardMut])

  const addWidget = useCallback(async (type) => {
    if (!currentDashboardId) return
    const ct = CHART_TYPES.find(c => c.type === type)
    if (!ct) return
    await createWidgetMut.mutateAsync({ dashboardId: currentDashboardId, chart_type: type, title: ct.label })
  }, [currentDashboardId, createWidgetMut])

  const updateWidget = useCallback((id, updates) => {
    if (!currentDashboardId) return
    updateWidgetMut.mutate({ id, dashboardId: currentDashboardId, ...updates })
  }, [currentDashboardId, updateWidgetMut])

  const deleteWidget = useCallback((id) => {
    if (!currentDashboardId) return
    deleteWidgetMut.mutate({ id, dashboardId: currentDashboardId })
  }, [currentDashboardId, deleteWidgetMut])

  const widgets = currentDashboard?.widgets || []
  const isLoading = dashboardsLoading || dashboardLoading

  // Drag and drop
  const handleDragStart = useCallback((e, widgetId) => { setDraggedWidgetId(widgetId); e.dataTransfer.effectAllowed = 'move' }, [])
  const handleDragOver = useCallback((e, widgetId) => { e.preventDefault(); if (draggedWidgetId && widgetId !== draggedWidgetId) setDragOverWidgetId(widgetId) }, [draggedWidgetId])
  const handleDragLeave = useCallback(() => setDragOverWidgetId(null), [])
  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault()
    if (!draggedWidgetId || !currentDashboardId || draggedWidgetId === targetId) { setDraggedWidgetId(null); setDragOverWidgetId(null); return }
    const arr = [...widgets]
    const from = arr.findIndex(w => w.id === draggedWidgetId)
    const to = arr.findIndex(w => w.id === targetId)
    if (from !== -1 && to !== -1) {
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      reorderWidgetsMut.mutate({ dashboardId: currentDashboardId, widgetIds: arr.map(w => w.id) })
    }
    setDraggedWidgetId(null); setDragOverWidgetId(null)
  }, [draggedWidgetId, currentDashboardId, widgets, reorderWidgetsMut])
  const handleDragEnd = useCallback(() => { setDraggedWidgetId(null); setDragOverWidgetId(null) }, [])

  return (
    <div className="app-content" style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="page-title">Financial Dashboard</h1>
          <DashboardSelector dashboards={dashboards} currentId={currentDashboardId || ''} isLoading={isLoading} onSelect={selectDashboard} onCreate={openCreateModal} onRename={renameDashboard} onDelete={deleteDashboard} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <GlobalMonthSelector year={globalYear} month={globalMonth} onChange={handleMonthChange} />
          <button onClick={() => setShowAddModal(true)} disabled={!currentDashboardId} className="btn btn-green btn-sm">+ Add Widget</button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading dashboard…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 20 }}>
            {widgets.map(widget => (
              <WidgetCard key={widget.id} widget={widget} costApi={costApi} year={globalYear} month={globalMonth}
                accounts={accounts} services={services} accountsLoading={accountsLoading} servicesLoading={servicesLoading}
                onUpdate={updateWidget} onDelete={deleteWidget}
                isDragging={draggedWidgetId === widget.id} isDragOver={dragOverWidgetId === widget.id}
                onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd} />
            ))}
          </div>
          {widgets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }}>📊</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No widgets yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Add a widget to start tracking your cloud costs.</p>
              <button onClick={() => setShowAddModal(true)} disabled={!currentDashboardId} className="btn btn-green">+ Add Your First Widget</button>
            </div>
          )}
        </>
      )}
      {showAddModal && <AddWidgetModal onAdd={addWidget} onClose={() => setShowAddModal(false)} />}
      {showCreateModal && <CreateDashboardModal onConfirm={createDashboard} onClose={() => setShowCreateModal(false)} />}
    </div>
  )
}

export default function FinancialDashboard(props) {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardInner {...props} />
    </QueryClientProvider>
  )
}

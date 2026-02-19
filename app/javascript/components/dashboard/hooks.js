import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Dashboard CRUD hooks ──────────────────────────────────────────

export function useDashboards(dashboardApi) {
    return useQuery({
        queryKey: ['dashboards'],
        queryFn: () => dashboardApi.list(),
        staleTime: 30_000,
    })
}

export function useDashboard(dashboardApi, dashboardId) {
    return useQuery({
        queryKey: ['dashboard', dashboardId],
        queryFn: () => dashboardApi.get(dashboardId),
        enabled: !!dashboardId,
        staleTime: 10_000,
    })
}

export function useCreateDashboard(dashboardApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data) => dashboardApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
    })
}

export function useUpdateDashboard(dashboardApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, ...data }) => dashboardApi.update(id, data),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ['dashboard', data?.id] })
            qc.invalidateQueries({ queryKey: ['dashboards'] })
        },
    })
}

export function useDeleteDashboard(dashboardApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id) => dashboardApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboards'] }),
    })
}


// ── Widget CRUD hooks ─────────────────────────────────────────────

export function useCreateWidget(widgetApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ dashboardId, ...data }) => widgetApi.create(dashboardId, data),
        onSuccess: (data) => qc.invalidateQueries({ queryKey: ['dashboard', data?.dashboard_id] }),
    })
}

export function useUpdateWidget(widgetApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, dashboardId, ...data }) => widgetApi.update(dashboardId, id, data),
        onSuccess: (data) => qc.invalidateQueries({ queryKey: ['dashboard', data?.dashboard_id] }),
    })
}

export function useDeleteWidget(widgetApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, dashboardId }) => widgetApi.delete(dashboardId, id),
        onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dashboard', vars.dashboardId] }),
    })
}

export function useReorderWidgets(dashboardApi) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ dashboardId, widgetIds }) => dashboardApi.reorder(dashboardId, widgetIds),
        onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dashboard', vars.dashboardId] }),
    })
}

// ── Cost data hooks ───────────────────────────────────────────────

export function useDailySpend(costApi, params) {
    return useQuery({
        queryKey: ['dailySpend', params],
        queryFn: () => costApi.dailySpend(params),
        enabled: !!params,
        staleTime: 5 * 60_000,
    })
}

export function useServiceSpend(costApi, params) {
    return useQuery({
        queryKey: ['serviceSpend', params],
        queryFn: () => costApi.serviceSpend(params),
        enabled: !!params,
        staleTime: 5 * 60_000,
    })
}

export function useStorageSpend(costApi, params) {
    return useQuery({
        queryKey: ['storageSpend', params],
        queryFn: () => costApi.storageSpend(params),
        enabled: !!params,
        staleTime: 5 * 60_000,
    })
}

export function useMonthlySpendTrend(costApi, params) {
    return useQuery({
        queryKey: ['monthlySpendTrend', params],
        queryFn: () => costApi.monthlySpendTrend(params),
        enabled: !!params,
        staleTime: 10 * 60_000,
    })
}

export function useAccountSpendDistribution(costApi, params) {
    return useQuery({
        queryKey: ['accountSpendDistribution', params],
        queryFn: () => costApi.accountSpendDistribution(params),
        enabled: !!params,
        staleTime: 5 * 60_000,
    })
}

export function useTopServices(costApi, params) {
    return useQuery({
        queryKey: ['topServices', params],
        queryFn: () => costApi.topServices(params),
        enabled: !!params,
        staleTime: 5 * 60_000,
    })
}

export function useDistinctAccounts(costApi, provider) {
    return useQuery({
        queryKey: ['distinctAccounts', provider],
        queryFn: () => costApi.getAccounts(provider),
        staleTime: 10 * 60_000,
    })
}

export function useDistinctServices(costApi, provider) {
    return useQuery({
        queryKey: ['distinctServices', provider],
        queryFn: () => costApi.getServices(provider),
        staleTime: 10 * 60_000,
    })
}

// ── Data transformers ─────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function transformDailySpendToChartData(response) {
    if (!response?.accounts?.length) return null
    const dateMap = new Map()
    for (const account of response.accounts) {
        account.dates.forEach((date, i) => {
            dateMap.set(date, (dateMap.get(date) || 0) + (account.series[0]?.values[i] || 0))
        })
    }
    const sorted = Array.from(dateMap.keys()).sort()
    return { labels: sorted.map(d => new Date(d).getDate().toString()), datasets: [{ label: 'Daily Spend', data: sorted.map(d => dateMap.get(d) || 0) }] }
}

export function transformServiceSpendToChartData(response) {
    if (!response?.accounts?.length) return null
    const serviceMap = new Map()
    const allDates = new Set()
    for (const account of response.accounts) {
        account.dates.forEach(d => allDates.add(d))
        for (const series of account.series) {
            if (!serviceMap.has(series.name)) serviceMap.set(series.name, new Map())
            const m = serviceMap.get(series.name)
            account.dates.forEach((date, i) => m.set(date, (m.get(date) || 0) + (series.values[i] || 0)))
        }
    }
    const sorted = Array.from(allDates).sort()
    const top = Array.from(serviceMap.entries())
        .map(([name, dates]) => ({ name, total: Array.from(dates.values()).reduce((a, b) => a + b, 0), dates }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
    return { labels: sorted.map(d => new Date(d).getDate().toString()), datasets: top.map(s => ({ label: s.name, data: sorted.map(d => s.dates.get(d) || 0) })) }
}

export function transformMonthlyTrendToChartData(response) {
    if (!response?.data?.length) return null
    return response.data.map(item => ({ name: `${MONTH_NAMES[item.month - 1]} ${item.year}`, value: item.total_cost }))
}

export function transformAccountSpendToChartData(response) {
    if (!response?.accounts?.length) return null
    return response.accounts.map(a => ({ name: a.account_id, value: a.total_cost, services: a.services }))
}

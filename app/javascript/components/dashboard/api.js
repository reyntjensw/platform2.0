function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]')
    return meta ? meta.getAttribute('content') : ''
}

async function request(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken(),
            ...options.headers,
        },
    })

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || error.detail || `Request failed with status ${res.status}`)
    }

    if (res.status === 204) return undefined
    return res.json()
}

export function createDashboardApi(baseUrl) {
    return {
        list: () => request(baseUrl),
        get: (id) => request(`${baseUrl}/${id}`),
        create: (data) => request(baseUrl, { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => request(`${baseUrl}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id) => request(`${baseUrl}/${id}`, { method: 'DELETE' }),
        reorder: (id, widgetIds) =>
            request(`${baseUrl}/${id}/reorder`, {
                method: 'PATCH',
                body: JSON.stringify({ widget_ids: widgetIds }),
            }),
    }
}

export function createWidgetApi(baseUrl) {
    return {
        create: (dashboardId, data) =>
            request(`${baseUrl}/${dashboardId}/widgets`, { method: 'POST', body: JSON.stringify(data) }),
        update: (dashboardId, id, data) =>
            request(`${baseUrl}/${dashboardId}/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (dashboardId, id) =>
            request(`${baseUrl}/${dashboardId}/widgets/${id}`, { method: 'DELETE' }),
    }
}

export function createCostApi(baseUrl, customerUuid) {
    return {
        dailySpend: (data) =>
            request(`${baseUrl}/daily_spend`, { method: 'POST', body: JSON.stringify({ ...data, customer_uuid: customerUuid }) }),
        serviceSpend: (data) =>
            request(`${baseUrl}/service_spend`, { method: 'POST', body: JSON.stringify({ ...data, customer_uuid: customerUuid }) }),
        storageSpend: (data) =>
            request(`${baseUrl}/storage_spend`, { method: 'POST', body: JSON.stringify({ ...data, customer_uuid: customerUuid }) }),
        monthlySpendTrend: (data) =>
            request(`${baseUrl}/monthly_spend_trend`, { method: 'POST', body: JSON.stringify({ ...data, customer_uuid: customerUuid }) }),
        accountSpendDistribution: (data) =>
            request(`${baseUrl}/account_spend_distribution`, { method: 'POST', body: JSON.stringify({ ...data, customer_uuid: customerUuid }) }),
        topServices: (data) =>
            request(`${baseUrl}/top_services`, { method: 'POST', body: JSON.stringify({ ...data, customer_uuid: customerUuid }) }),
        getAccounts: (provider) =>
            request(`${baseUrl}/accounts${provider ? `?provider=${provider}` : ''}`),
        getServices: (provider) =>
            request(`${baseUrl}/services${provider ? `?provider=${provider}` : ''}`),
    }
}

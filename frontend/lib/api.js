const BASE = 'http://localhost:8000/api'

function qs(params) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '' && v !== 'all') p.append(k, v)
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export async function fetchFilters() {
  const r = await fetch(`${BASE}/filters`)
  return r.json()
}

export async function fetchSummary(filters = {}) {
  const r = await fetch(`${BASE}/summary${qs(filters)}`)
  return r.json()
}

export async function fetchMonthly(filters = {}) {
  const r = await fetch(`${BASE}/monthly${qs(filters)}`)
  return r.json()
}

export async function fetchByCountry(filters = {}) {
  const r = await fetch(`${BASE}/by-country${qs({ limit: 10, ...filters })}`)
  return r.json()
}

export async function fetchByIndustry(filters = {}) {
  const r = await fetch(`${BASE}/by-industry${qs({ limit: 10, ...filters })}`)
  return r.json()
}

export async function fetchSentiment() {
  const r = await fetch(`${BASE}/sentiment?limit=50`)
  return r.json()
}

export async function fetchEvents(filters = {}) {
  const r = await fetch(`${BASE}/events${qs({ limit: 20, ...filters })}`)
  return r.json()
}

export async function fetchCountryFeatures(country, industry = null) {
  const params = industry ? `?industry=${encodeURIComponent(industry)}` : ''
  const r = await fetch(`${BASE}/country-features/${encodeURIComponent(country)}${params}`)
  return r.json()
}

export async function postPredict(features) {
  const r = await fetch(`${BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features),
  })
  return r.json()
}

export async function postForecast(country, period = 'quarterly', industry = null) {
  const body = { country, period }
  if (industry) body.industry = industry
  const r = await fetch(`${BASE}/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

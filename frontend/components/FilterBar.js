'use client'

export default function FilterBar({ filters = {}, setFilters, countries = [], industries = [] }) {
  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))

  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
    }}>
      {/* Country */}
      <div className="filter-select-wrap">
        <select value={filters.country || 'all'}
          onChange={e => update('country', e.target.value === 'all' ? '' : e.target.value)}>
          <option value="all">Tous les pays</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Industry */}
      <div className="filter-select-wrap">
        <select value={filters.industry || 'all'}
          onChange={e => update('industry', e.target.value === 'all' ? '' : e.target.value)}>
          <option value="all">Toutes les industries</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Date range */}
      <input type="date" className="filter-date"
        value={filters.start_date || ''}
        onChange={e => update('start_date', e.target.value)}
        placeholder="Début" />
      <input type="date" className="filter-date"
        value={filters.end_date || ''}
        onChange={e => update('end_date', e.target.value)}
        placeholder="Fin" />

      {/* AI toggle */}
      <div className="filter-select-wrap">
        <select value={filters.is_ai ?? 'all'}
          onChange={e => {
            const v = e.target.value
            update('is_ai', v === 'all' ? null : v === 'true')
          }}>
          <option value="all">Toutes les entreprises</option>
          <option value="true">Entreprises IA</option>
          <option value="false">Non-IA</option>
        </select>
      </div>

      {/* Reset */}
      <button className="filter-reset"
        onClick={() => setFilters({})}>Réinitialiser</button>
    </div>
  )
}

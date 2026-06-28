'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Mail, GraduationCap, Calendar, Tag, Briefcase, Languages,
  Clock, MapPin, Building2, ChevronRight, ChevronLeft,
  Sparkles, Globe2, BookOpen, Lightbulb, ExternalLink,
  AlertCircle, Loader2, Send, CheckCircle2, X, Save, Bookmark,
  Globe, Cpu
} from 'lucide-react'

/* ── Constants ──────────────────────────────────────── */
const NIVEAUX = ['Bac', 'Bac+2', 'Bac+3 / Licence', 'Bac+5 / Master', 'Doctorat', 'Autre']
const DIPLOMES = [
  'Informatique', 'Data Science', 'Génie Logiciel', 'Réseaux & Télécoms',
  'Électronique', 'Génie Industriel', 'Commerce & Marketing',
  'Finance & Comptabilité', 'Ressources Humaines', 'Droit',
  'Médecine', 'Design', 'Communication', 'Autre'
]
const DISPONIBILITES = ['Immédiate', 'Dans 1 mois', 'Dans 3 mois', 'Dans 6 mois', 'Flexible']
const TYPES_TRAVAIL = ['Remote', 'Hybride', 'Présentiel']
const PAYS = [
  'France', 'Allemagne', 'Royaume-Uni', 'États-Unis', 'Canada',
  'Espagne', 'Italie', 'Pays-Bas', 'Belgique', 'Suisse',
  'Australie', 'Brésil', 'Inde', 'Singapour', 'Afrique du Sud'
]
const LANGUES_LIST = ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Arabe', 'Chinois', 'Portugais', 'Italien', 'Néerlandais', 'Japonais']

const STEPS = [
  { label: 'Profil', icon: GraduationCap },
  { label: 'Compétences', icon: Briefcase },
  { label: 'Préférences', icon: MapPin },
]

/* ── Tag Input Component ────────────────────────────── */
function TagInput({ tags, setTags, placeholder, suggestions }) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const addTag = (tag) => {
    const clean = tag.trim()
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean])
    }
    setInput('')
    setShowSuggestions(false)
  }

  const removeTag = (idx) => setTags(tags.filter((_, i) => i !== idx))

  const filtered = suggestions
    ? suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s))
    : []

  return (
    <div className="reco-tag-input-wrap">
      <div className="reco-tags-container">
        {tags.map((t, i) => (
          <span key={i} className="reco-tag">
            {t}
            <button type="button" onClick={() => removeTag(i)} className="reco-tag-remove">
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(input) } }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="reco-tag-field"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div className="reco-suggestions">
          {filtered.slice(0, 6).map((s, i) => (
            <button key={i} type="button" className="reco-suggestion-item" onMouseDown={() => addTag(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────── */
export default function RecommandationPage() {
  const { data: session } = useSession()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [savedReco, setSavedReco] = useState(false)
  const [savedJobs, setSavedJobs] = useState({})
  const [selectedModel, setSelectedModel] = useState('ollama-fast')

  // Form state
  const [form, setForm] = useState({
    email: '', niveau: '', diplome: '', anneeObtention: '',
    competences: [], experience: '', langues: [],
    disponibilite: '', typeTravail: '', paysCible: '',
  })
  
  const [isMounted, setIsMounted] = useState(false)

  // Hydrate from sessionStorage AFTER first render to avoid mismatch
  useEffect(() => {
    setIsMounted(true)
    const sStep = sessionStorage.getItem('reco_step')
    if (sStep) setStep(Number(sStep))
    
    const sResult = sessionStorage.getItem('reco_result')
    if (sResult) setResult(JSON.parse(sResult))
    
    const sForm = sessionStorage.getItem('reco_form')
    if (sForm) setForm(JSON.parse(sForm))
  }, [])

  // Persist state to sessionStorage
  useEffect(() => { if (isMounted) sessionStorage.setItem('reco_form', JSON.stringify(form)) }, [form, isMounted])
  useEffect(() => { if (isMounted) sessionStorage.setItem('reco_step', String(step)) }, [step, isMounted])
  useEffect(() => { if (isMounted && result) sessionStorage.setItem('reco_result', JSON.stringify(result)) }, [result, isMounted])

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  /* ── Validation per step ───────────────────────── */
  const isStepValid = (s) => {
    switch (s) {
      case 0: return form.email && form.niveau && form.diplome && form.anneeObtention
      case 1: return form.competences.length > 0 && form.experience && form.langues.length > 0
      case 2: return form.disponibilite && form.typeTravail && form.paysCible
      default: return false
    }
  }

  /* ── Submit ─────────────────────────────────────── */
  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, model: selectedModel }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la requête')
      }

      setResult(data)
      setSavedReco(false)
      // Auto-save to MongoDB if logged in
      if (session) {
        try {
          await fetch('/api/user/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData: form, results: data })
          })
          setSavedReco(true)
          
          // Auto-save all recommended jobs to savedjobs collection
          if (data.offres && Array.isArray(data.offres)) {
            await Promise.all(data.offres.map(o => 
              fetch('/api/user/saved-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  titre: o.titre.replace(/<[^>]*>/g, ''),
                  entreprise: o.entreprise,
                  pays: o.lieu || 'Non précisé',
                  lien: o.url,
                  salaire: o.salaire,
                  source: 'Adzuna'
                })
              })
            ))
            // Update UI state to show all as saved
            const newSavedJobs = {}
            data.offres.forEach((_, i) => newSavedJobs[i] = true)
            setSavedJobs(newSavedJobs)
          }
        } catch (e) { console.error('Auto-save failed') }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /* ── Current year for select ────────────────────── */
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

  const handleSaveRecommendation = async () => {
    if (!session) {
      alert("Veuillez vous connecter pour sauvegarder une recommandation.")
      return
    }
    try {
      const res = await fetch('/api/user/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: form, results: result })
      })
      if (res.ok) setSavedReco(true)
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la recommandation')
    }
  }

  const handleSaveJob = async (e, o, index) => {
    e.preventDefault() // Prevent navigation since it's an <a> tag
    if (!session) {
      alert("Veuillez vous connecter pour sauvegarder une offre.")
      return
    }
    try {
      const res = await fetch('/api/user/saved-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: o.titre.replace(/<[^>]*>/g, ''),
          entreprise: o.entreprise,
          pays: o.lieu || 'Non précisé',
          lien: o.url,
          salaire: o.salaire,
          source: 'Adzuna'
        })
      })
      if (res.ok) {
        setSavedJobs(prev => ({ ...prev, [index]: true }))
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de l\'offre')
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Recommandation Carrière</h1>
        <p>Obtenez des recommandations personnalisées basées sur votre profil · Alimenté par l'IA</p>
      </div>

      {/* ── Stepper ────────────────────────────────── */}
      <div className="reco-stepper">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const active = i === step
          return (
            <div key={i} className="reco-stepper-row">
              {i > 0 && <div className={`reco-stepper-line ${i <= step ? 'done' : ''}`} />}
              <button
                type="button"
                className={`reco-step-btn ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                onClick={() => { if (done) setStep(i) }}
              >
                <div className="reco-step-circle">
                  {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span>{s.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Form Card ─────────────────────────────── */}
      <div className="reco-form-card fade-in" key={step}>

        {/* Step 1: Profil */}
        {step === 0 && (
          <div className="reco-fields">
            <div className="reco-field">
              <label className="reco-label"><Mail size={13} /> Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="votre@email.com"
                className="reco-input"
                id="reco-email"
              />
            </div>
            <div className="reco-field">
              <label className="reco-label"><GraduationCap size={13} /> Niveau d'études</label>
              <div className="select-wrapper">
                <select value={form.niveau} onChange={e => set('niveau', e.target.value)} id="reco-niveau">
                  <option value="">Sélectionner</option>
                  {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="reco-field">
              <label className="reco-label"><BookOpen size={13} /> Nature du diplôme</label>
              <div className="select-wrapper">
                <select value={form.diplome} onChange={e => set('diplome', e.target.value)} id="reco-diplome">
                  <option value="">Sélectionner</option>
                  {DIPLOMES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="reco-field">
              <label className="reco-label"><Calendar size={13} /> Année d'obtention</label>
              <div className="select-wrapper">
                <select value={form.anneeObtention} onChange={e => set('anneeObtention', e.target.value)} id="reco-annee">
                  <option value="">Sélectionner</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Compétences */}
        {step === 1 && (
          <div className="reco-fields">
            <div className="reco-field">
              <label className="reco-label"><Tag size={13} /> Compétences</label>
              <TagInput
                tags={form.competences}
                setTags={v => set('competences', v)}
                placeholder="Tapez et appuyez Entrée..."
                suggestions={[
                  'Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'Machine Learning',
                  'Data Analysis', 'Docker', 'AWS', 'DevOps', 'TypeScript', 'Java',
                  'C++', 'Excel', 'Power BI', 'Tableau', 'Git', 'Linux', 'MongoDB',
                  'GraphQL', 'Figma', 'UI/UX', 'Agile', 'Scrum', 'Communication',
                  'Leadership', 'Gestion de projet', 'Marketing digital', 'SEO',
                ]}
              />
            </div>
            <div className="reco-field">
              <label className="reco-label"><Briefcase size={13} /> Années d'expérience</label>
              <div className="select-wrapper">
                <select value={form.experience} onChange={e => set('experience', e.target.value)} id="reco-experience">
                  <option value="">Sélectionner</option>
                  <option value="0">Débutant (0)</option>
                  <option value="1-2">1 – 2 ans</option>
                  <option value="3-5">3 – 5 ans</option>
                  <option value="5-10">5 – 10 ans</option>
                  <option value="10+">10+ ans</option>
                </select>
              </div>
            </div>
            <div className="reco-field">
              <label className="reco-label"><Languages size={13} /> Langues</label>
              <TagInput
                tags={form.langues}
                setTags={v => set('langues', v)}
                placeholder="Sélectionnez vos langues..."
                suggestions={LANGUES_LIST}
              />
            </div>
          </div>
        )}

        {/* Step 3: Préférences */}
        {step === 2 && (
          <div className="reco-fields">
            <div className="reco-field">
              <label className="reco-label"><Clock size={13} /> Disponibilité</label>
              <div className="select-wrapper">
                <select value={form.disponibilite} onChange={e => set('disponibilite', e.target.value)} id="reco-disponibilite">
                  <option value="">Sélectionner</option>
                  {DISPONIBILITES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="reco-field">
              <label className="reco-label"><Building2 size={13} /> Type de travail</label>
              <div className="reco-type-toggle">
                {TYPES_TRAVAIL.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`reco-type-btn ${form.typeTravail === t ? 'active' : ''}`}
                    onClick={() => set('typeTravail', t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="reco-field">
              <label className="reco-label"><Globe2 size={13} /> Pays cible</label>
              <div className="select-wrapper">
                <select value={form.paysCible} onChange={e => set('paysCible', e.target.value)} id="reco-pays">
                  <option value="">Sélectionner</option>
                  {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* AI Model Selector */}
            <div className="reco-model-selector" style={{ marginTop: '1.5rem' }}>
              <label className="reco-label" style={{ marginBottom: '0.75rem' }}><Cpu size={13} /> Modèle IA</label>
              <div className="jobly-model-toggle">
                <button
                  type="button"
                  className={`jobly-model-btn ${selectedModel === 'gemini' ? 'active' : ''}`}
                  onClick={() => setSelectedModel('gemini')}
                  disabled={loading}
                >
                  <Globe size={14} />
                  <span>Gemini Flash</span>
                  <span className="jobly-model-badge jobly-model-badge-green">Rapide</span>
                </button>
                <button
                  type="button"
                  className={`jobly-model-btn ${selectedModel === 'ollama-fast' ? 'active' : ''}`}
                  onClick={() => setSelectedModel('ollama-fast')}
                  disabled={loading}
                >
                  <Cpu size={14} />
                  <span>Llama 3.2</span>
                  <span className="jobly-model-badge jobly-model-badge-orange">⚡ Ultra-rapide</span>
                </button>
                <button
                  type="button"
                  className={`jobly-model-btn ${selectedModel === 'ollama' ? 'active' : ''}`}
                  onClick={() => setSelectedModel('ollama')}
                  disabled={loading}
                >
                  <Cpu size={14} />
                  <span>Llama 3.1</span>
                  <span className="jobly-model-badge jobly-model-badge-blue">Privé</span>
                </button>
              </div>
              <div className="jobly-model-desc" style={{ marginTop: '0.5rem' }}>
                {selectedModel === 'gemini'
                  ? 'Rapide · Nécessite internet'
                  : selectedModel === 'ollama-fast'
                  ? '⚡ Ultra-rapide · Local · 1.3GB'
                  : 'Confidentiel · Fonctionne hors-ligne'}
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────── */}
        <div className="reco-nav">
          {step > 0 && (
            <button type="button" className="reco-nav-btn secondary" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={15} /> Précédent
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 2 && (
            <button
              type="button"
              className="reco-nav-btn primary"
              disabled={!isStepValid(step)}
              onClick={() => setStep(step + 1)}
            >
              Suivant <ChevronRight size={15} />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="reco-nav-btn primary submit"
              disabled={!isStepValid(2) || loading}
              onClick={handleSubmit}
            >
              {loading ? (
                <><Loader2 size={15} className="reco-spin" /> Analyse en cours…</>
              ) : (
                <><Sparkles size={15} /> Obtenir mes recommandations</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Error ─────────────────────────────────── */}
      {error && (
        <div className="reco-error fade-in">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Results ───────────────────────────────── */}
      {result && (
        <div className="reco-results fade-in">
          <div className="reco-results-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Sparkles size={18} />
              <h2>Vos Recommandations Personnalisées</h2>
            </div>
            {session && (
              <button 
                onClick={handleSaveRecommendation} 
                disabled={savedReco}
                className={`save-floating-btn ${savedReco ? 'saved' : ''}`}
                style={{ position: 'static', opacity: savedReco ? 0.7 : 1, cursor: savedReco ? 'default' : 'pointer' }}
              >
                {savedReco ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {savedReco ? 'Sauvegardée' : 'Sauvegarder manuellement'}
              </button>
            )}
          </div>

          <div className="reco-results-grid">
            {/* Secteurs */}
            <div className="reco-result-card">
              <div className="reco-result-card-head">
                <div className="reco-result-icon indigo"><Building2 size={16} /></div>
                <h3>Secteurs Recommandés</h3>
              </div>
              <div className="reco-result-items">
                {result.secteurs.map((s, i) => (
                  <span key={i} className="reco-result-chip indigo">{s}</span>
                ))}
              </div>
            </div>

            {/* Domaines */}
            <div className="reco-result-card">
              <div className="reco-result-card-head">
                <div className="reco-result-icon emerald"><Briefcase size={16} /></div>
                <h3>Domaines d'Activité</h3>
              </div>
              <div className="reco-result-items">
                {result.domaines.map((d, i) => (
                  <span key={i} className="reco-result-chip emerald">{d}</span>
                ))}
              </div>
            </div>

            {/* Pays */}
            <div className="reco-result-card">
              <div className="reco-result-card-head">
                <div className="reco-result-icon amber"><Globe2 size={16} /></div>
                <h3>Pays Porteurs</h3>
              </div>
              <div className="reco-result-items">
                {result.pays.map((p, i) => (
                  <span key={i} className="reco-result-chip amber">{p}</span>
                ))}
              </div>
            </div>

            {/* Compétences à acquérir */}
            <div className="reco-result-card">
              <div className="reco-result-card-head">
                <div className="reco-result-icon rose"><Lightbulb size={16} /></div>
                <h3>Compétences à Acquérir</h3>
              </div>
              <div className="reco-result-items">
                {result.competencesAcquerir.map((c, i) => (
                  <span key={i} className="reco-result-chip rose">{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Conseil IA */}
          <div className="reco-conseil-card">
            <div className="reco-conseil-head">
              <Sparkles size={16} />
              <h3>Conseil Personnalisé de l'IA</h3>
            </div>
            <p>{result.conseil}</p>
          </div>

          {/* Offres réelles */}
          {result.offres && result.offres.length > 0 && (
            <div className="reco-offres-section">
              <div className="reco-offres-head">
                <Send size={16} />
                <h3>Offres d'Emploi Réelles</h3>
                <span className="panel-badge">{result.offres.length} résultats</span>
              </div>
              <div className="reco-offres-grid">
                {result.offres.map((o, i) => (
                  <a
                    key={i}
                    href={o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reco-offre-card"
                  >
                    <div className="reco-offre-top">
                      <h4>{o.titre.replace(/<[^>]*>/g, '')}</h4>
                      <ExternalLink size={13} className="reco-offre-ext" />
                    </div>
                    <div className="reco-offre-meta">
                      <span><Building2 size={12} /> {o.entreprise}</span>
                      <span><MapPin size={12} /> {o.lieu || 'Non précisé'}</span>
                    </div>
                    {o.salaire && (
                      <div className="reco-offre-salary">{o.salaire}</div>
                    )}
                    {o.date && (
                      <div className="reco-offre-date">{o.date}</div>
                    )}
                    {session && (
                      <button 
                        onClick={(e) => handleSaveJob(e, o, i)}
                        style={{
                          marginTop: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: savedJobs[i] ? 'var(--success-dim)' : 'var(--surface-alt)',
                          color: savedJobs[i] ? 'var(--success)' : 'var(--text-secondary)',
                          border: 'none',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          width: 'max-content'
                        }}
                      >
                        {savedJobs[i] ? <CheckCircle2 size={12} /> : <Bookmark size={12} />}
                        {savedJobs[i] ? 'Sauvegardée' : 'Sauvegarder'}
                      </button>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

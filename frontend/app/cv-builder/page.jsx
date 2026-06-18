'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  User, Briefcase, GraduationCap, Brain, Layout,
  Plus, Trash2, ChevronRight, ChevronLeft, Sparkles,
  Download, FileText, RotateCcw, Edit3, X, Check, Save, CheckCircle2
} from 'lucide-react'

const STEPS = [
  { num: 1, label: 'Informations', icon: User },
  { num: 2, label: 'Expériences', icon: Briefcase },
  { num: 3, label: 'Formations', icon: GraduationCap },
  { num: 4, label: 'Compétences', icon: Brain },
  { num: 5, label: 'Template', icon: Layout },
]

const NIVEAUX_LANGUE = ['Débutant', 'Intermédiaire', 'Avancé', 'Bilingue', 'Natif']

const EMPTY_EXP = { poste: '', entreprise: '', ville: '', dateDebut: '', dateFin: '', posteActuel: false, description: '' }
const EMPTY_FORMATION = { diplome: '', etablissement: '', annee: '', mention: '' }
const EMPTY_LANGUE = { langue: '', niveau: 'Intermédiaire' }

export default function CvBuilderPage() {
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    prenom: '', nom: '', titre: '', email: '', telephone: '', ville: '', pays: '',
    linkedin: '', github: '', siteWeb: '', photo: null, resume: '',
    experiences: [{ ...EMPTY_EXP }],
    formations: [{ ...EMPTY_FORMATION }],
    competencesTech: [], competencesSoft: [], langues: [{ ...EMPTY_LANGUE }], centresInteret: '',
    template: 'moderne',
  })
  const [tagInputTech, setTagInputTech] = useState('')
  const [tagInputSoft, setTagInputSoft] = useState('')
  const [cvData, setCvData] = useState(null)
  const [cvId, setCvId] = useState(null)
  const [savedCV, setSavedCV] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const cvRef = useRef(null)

  const [isMounted, setIsMounted] = useState(false)

  // Hydrate from sessionStorage AFTER first render to avoid mismatch
  useEffect(() => {
    setIsMounted(true)
    const sStep = sessionStorage.getItem('cv_step')
    if (sStep) setStep(Number(sStep))
    
    const sFormData = sessionStorage.getItem('cv_formData')
    if (sFormData) setFormData(JSON.parse(sFormData))
    
    const sCvData = sessionStorage.getItem('cv_cvData')
    if (sCvData) setCvData(JSON.parse(sCvData))
    
    const sShowPreview = sessionStorage.getItem('cv_showPreview')
    if (sShowPreview) setShowPreview(sShowPreview === 'true')
  }, [])

  // Persist state to sessionStorage
  useEffect(() => { if (isMounted) sessionStorage.setItem('cv_formData', JSON.stringify(formData)) }, [formData, isMounted])
  useEffect(() => { if (isMounted) sessionStorage.setItem('cv_step', String(step)) }, [step, isMounted])
  useEffect(() => { if (isMounted && cvData) sessionStorage.setItem('cv_cvData', JSON.stringify(cvData)) }, [cvData, isMounted])
  useEffect(() => { if (isMounted) sessionStorage.setItem('cv_showPreview', String(showPreview)) }, [showPreview, isMounted])

  // ── Field updaters ──
  const updateField = (field, value) => setFormData(p => ({ ...p, [field]: value }))

  const updateExp = (i, field, value) => {
    const exps = [...formData.experiences]
    exps[i] = { ...exps[i], [field]: value }
    setFormData(p => ({ ...p, experiences: exps }))
  }
  const addExp = () => setFormData(p => ({ ...p, experiences: [...p.experiences, { ...EMPTY_EXP }] }))
  const removeExp = (i) => setFormData(p => ({ ...p, experiences: p.experiences.filter((_, j) => j !== i) }))

  const updateForm = (i, field, value) => {
    const forms = [...formData.formations]
    forms[i] = { ...forms[i], [field]: value }
    setFormData(p => ({ ...p, formations: forms }))
  }
  const addFormation = () => setFormData(p => ({ ...p, formations: [...p.formations, { ...EMPTY_FORMATION }] }))
  const removeFormation = (i) => setFormData(p => ({ ...p, formations: p.formations.filter((_, j) => j !== i) }))

  const updateLangue = (i, field, value) => {
    const langs = [...formData.langues]
    langs[i] = { ...langs[i], [field]: value }
    setFormData(p => ({ ...p, langues: langs }))
  }
  const addLangue = () => setFormData(p => ({ ...p, langues: [...p.langues, { ...EMPTY_LANGUE }] }))
  const removeLangue = (i) => setFormData(p => ({ ...p, langues: p.langues.filter((_, j) => j !== i) }))

  const addTag = (field, setter, value) => {
    const v = value.trim()
    if (v && !formData[field].includes(v)) {
      setFormData(p => ({ ...p, [field]: [...p[field], v] }))
    }
    setter('')
  }
  const removeTag = (field, i) => setFormData(p => ({ ...p, [field]: p[field].filter((_, j) => j !== i) }))

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateField('photo', reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Generate CV with AI ──
  async function generateCV() {
    setIsGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/cv-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }
      const data = await res.json()
      setCvData(data.cv)
      setShowPreview(true)
      setSavedCV(false)
      // Auto-save CV to MongoDB if logged in
      if (session) {
        try {
          const saveRes = await fetch('/api/user/cvs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData, template: formData.template, id: cvId })
          })
          if (saveRes.ok) {
            const saveData = await saveRes.json()
            setCvId(saveData._id)
            setSavedCV(true)
          }
        } catch (e) { console.error('Auto-save CV failed') }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Download PDF ──
  async function downloadPDF() {
    const html2pdf = (await import('html2pdf.js')).default
    const el = cvRef.current
    if (!el) return
    html2pdf().set({
      margin: 10,
      filename: `CV_${formData.prenom || 'Mon'}_${formData.nom || 'CV'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save()
  }

  // ── Download Word ──
  async function downloadWord() {
    try {
      const res = await fetch('/api/cv-download-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cvData),
      })
      if (!res.ok) throw new Error('Erreur génération Word')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CV_${formData.prenom || 'Mon'}_${formData.nom || 'CV'}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSaveCV = async () => {
    if (!session) {
      alert("Veuillez vous connecter pour sauvegarder votre CV.")
      return
    }
    try {
      const res = await fetch('/api/user/cvs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, template: formData.template, id: cvId })
      })
      if (res.ok) {
        const data = await res.json()
        setCvId(data._id)
        setSavedCV(true)
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du CV')
    }
  }

  // ── PREVIEW MODE ──
  if (showPreview && cvData) {
    return (
      <div className="cv-builder" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Aperçu du CV</h1>
            <p>Votre CV a été enrichi par l&apos;IA — Vérifiez et téléchargez</p>
          </div>
          {session && (
            <button 
              onClick={handleSaveCV} 
              className={`save-floating-btn ${savedCV ? 'saved' : ''}`}
              style={{ position: 'static' }}
            >
              {savedCV ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {savedCV ? 'Sauvegardé' : 'Sauvegarder dans mon profil'}
            </button>
          )}
        </div>
        <div className="cv-preview-actions">
          <button className="cv-action-btn cv-action-primary" onClick={downloadPDF}><Download size={14} /> Télécharger PDF</button>
          <button className="cv-action-btn cv-action-secondary" onClick={downloadWord}><FileText size={14} /> Télécharger Word</button>
          <button className="cv-action-btn cv-action-outline" onClick={() => setShowPreview(false)}><Edit3 size={14} /> Modifier</button>
          <button className="cv-action-btn cv-action-outline" onClick={generateCV} disabled={isGenerating}>
            <RotateCcw size={14} /> {isGenerating ? 'Régénération...' : 'Régénérer avec l\'IA'}
          </button>
        </div>
        <div className="cv-preview-container">
          <div ref={cvRef}>
            {formData.template === 'moderne' && <CvModerne cv={cvData} />}
            {formData.template === 'classique' && <CvClassique cv={cvData} />}
            {formData.template === 'minimaliste' && <CvMinimaliste cv={cvData} />}
          </div>
        </div>
      </div>
    )
  }

  // ── FORM MODE ──
  return (
    <div className="cv-builder">
      <div className="page-head">
        <h1>CV Builder</h1>
        <p>Créez un CV professionnel enrichi par l&apos;intelligence artificielle</p>
      </div>

      {/* Stepper */}
      <div className="cv-stepper">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.num} className="cv-stepper-item-wrap">
              <button
                className={`cv-stepper-item ${step === s.num ? 'active' : ''} ${step > s.num ? 'done' : ''}`}
                onClick={() => setStep(s.num)}
              >
                <div className="cv-stepper-icon">{step > s.num ? <Check size={14} /> : <Icon size={14} />}</div>
                <span>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="cv-stepper-line" />}
            </div>
          )
        })}
      </div>

      {error && <div className="cv-error">{error}</div>}

      <div className="cv-form-panel">
        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="cv-step fade-in">
            <h2>Informations personnelles</h2>
            <div className="cv-fields-grid">
              <div className="cv-field"><label>Prénom *</label><input value={formData.prenom} onChange={e => updateField('prenom', e.target.value)} placeholder="Jean" /></div>
              <div className="cv-field"><label>Nom *</label><input value={formData.nom} onChange={e => updateField('nom', e.target.value)} placeholder="Dupont" /></div>
              <div className="cv-field cv-field-full"><label>Titre professionnel *</label><input value={formData.titre} onChange={e => updateField('titre', e.target.value)} placeholder="Développeur Full Stack" /></div>
              <div className="cv-field"><label>Email *</label><input type="email" value={formData.email} onChange={e => updateField('email', e.target.value)} placeholder="jean@email.com" /></div>
              <div className="cv-field"><label>Téléphone</label><input value={formData.telephone} onChange={e => updateField('telephone', e.target.value)} placeholder="+33 6 12 34 56 78" /></div>
              <div className="cv-field"><label>Ville</label><input value={formData.ville} onChange={e => updateField('ville', e.target.value)} placeholder="Paris" /></div>
              <div className="cv-field"><label>Pays</label><input value={formData.pays} onChange={e => updateField('pays', e.target.value)} placeholder="France" /></div>
              <div className="cv-field"><label>LinkedIn</label><input value={formData.linkedin} onChange={e => updateField('linkedin', e.target.value)} placeholder="linkedin.com/in/..." /></div>
              <div className="cv-field"><label>GitHub</label><input value={formData.github} onChange={e => updateField('github', e.target.value)} placeholder="github.com/..." /></div>
              <div className="cv-field"><label>Site web</label><input value={formData.siteWeb} onChange={e => updateField('siteWeb', e.target.value)} placeholder="www.monsite.com" /></div>
              <div className="cv-field">
                <label>Photo de profil</label>
                <div className="cv-photo-upload">
                  {formData.photo ? (
                    <div className="cv-photo-preview">
                      <img src={formData.photo} alt="Photo" />
                      <button onClick={() => updateField('photo', null)}><X size={12} /></button>
                    </div>
                  ) : (
                    <label className="cv-photo-btn">
                      <User size={16} /> Choisir une photo
                      <input type="file" accept="image/jpeg,image/png" onChange={handlePhoto} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
              <div className="cv-field cv-field-full"><label>Résumé professionnel</label><textarea rows={4} value={formData.resume} onChange={e => updateField('resume', e.target.value)} placeholder="Décrivez brièvement votre parcours et vos objectifs professionnels..." /></div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="cv-step fade-in">
            <div className="cv-step-head">
              <h2>Expériences professionnelles</h2>
              <button className="cv-add-btn" onClick={addExp}><Plus size={14} /> Ajouter</button>
            </div>
            {formData.experiences.map((exp, i) => (
              <div key={i} className="cv-entry-card">
                <div className="cv-entry-head">
                  <span className="cv-entry-num">Expérience {i + 1}</span>
                  {formData.experiences.length > 1 && (
                    <button className="cv-remove-btn" onClick={() => removeExp(i)}><Trash2 size={13} /></button>
                  )}
                </div>
                <div className="cv-fields-grid">
                  <div className="cv-field"><label>Poste occupé *</label><input value={exp.poste} onChange={e => updateExp(i, 'poste', e.target.value)} placeholder="Développeur Frontend" /></div>
                  <div className="cv-field"><label>Entreprise *</label><input value={exp.entreprise} onChange={e => updateExp(i, 'entreprise', e.target.value)} placeholder="Google" /></div>
                  <div className="cv-field"><label>Ville / Pays</label><input value={exp.ville} onChange={e => updateExp(i, 'ville', e.target.value)} placeholder="Paris, France" /></div>
                  <div className="cv-field">
                    <label>Période</label>
                    <div className="cv-date-row">
                      <input type="month" value={exp.dateDebut} onChange={e => updateExp(i, 'dateDebut', e.target.value)} />
                      <span>→</span>
                      {exp.posteActuel ? <span className="cv-current-badge">Présent</span> : (
                        <input type="month" value={exp.dateFin} onChange={e => updateExp(i, 'dateFin', e.target.value)} />
                      )}
                    </div>
                    <label className="cv-checkbox"><input type="checkbox" checked={exp.posteActuel} onChange={e => updateExp(i, 'posteActuel', e.target.checked)} /> Poste actuel</label>
                  </div>
                  <div className="cv-field cv-field-full"><label>Description des missions</label><textarea rows={3} value={exp.description} onChange={e => updateExp(i, 'description', e.target.value)} placeholder="Décrivez vos principales missions et réalisations..." /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="cv-step fade-in">
            <div className="cv-step-head">
              <h2>Formation académique</h2>
              <button className="cv-add-btn" onClick={addFormation}><Plus size={14} /> Ajouter</button>
            </div>
            {formData.formations.map((f, i) => (
              <div key={i} className="cv-entry-card">
                <div className="cv-entry-head">
                  <span className="cv-entry-num">Formation {i + 1}</span>
                  {formData.formations.length > 1 && (
                    <button className="cv-remove-btn" onClick={() => removeFormation(i)}><Trash2 size={13} /></button>
                  )}
                </div>
                <div className="cv-fields-grid">
                  <div className="cv-field"><label>Diplôme obtenu *</label><input value={f.diplome} onChange={e => updateForm(i, 'diplome', e.target.value)} placeholder="Master Informatique" /></div>
                  <div className="cv-field"><label>Établissement *</label><input value={f.etablissement} onChange={e => updateForm(i, 'etablissement', e.target.value)} placeholder="Université Paris-Saclay" /></div>
                  <div className="cv-field"><label>Année d&apos;obtention</label><input value={f.annee} onChange={e => updateForm(i, 'annee', e.target.value)} placeholder="2023" /></div>
                  <div className="cv-field"><label>Mention</label><input value={f.mention} onChange={e => updateForm(i, 'mention', e.target.value)} placeholder="Bien" /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STEP 4 ── */}
        {step === 4 && (
          <div className="cv-step fade-in">
            <h2>Compétences &amp; Langues</h2>
            <div className="cv-section-block">
              <label className="cv-section-label">Compétences techniques</label>
              <div className="cv-tag-input-wrap">
                <div className="cv-tags">{formData.competencesTech.map((t, i) => (<span key={i} className="cv-tag">{t}<button onClick={() => removeTag('competencesTech', i)}><X size={10} /></button></span>))}</div>
                <input value={tagInputTech} onChange={e => setTagInputTech(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('competencesTech', setTagInputTech, tagInputTech) }}} placeholder="Tapez et appuyez Entrée (ex: Python, React...)" />
              </div>
            </div>
            <div className="cv-section-block">
              <label className="cv-section-label">Soft skills</label>
              <div className="cv-tag-input-wrap">
                <div className="cv-tags">{formData.competencesSoft.map((t, i) => (<span key={i} className="cv-tag">{t}<button onClick={() => removeTag('competencesSoft', i)}><X size={10} /></button></span>))}</div>
                <input value={tagInputSoft} onChange={e => setTagInputSoft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('competencesSoft', setTagInputSoft, tagInputSoft) }}} placeholder="Tapez et appuyez Entrée (ex: Leadership...)" />
              </div>
            </div>
            <div className="cv-section-block">
              <div className="cv-step-head" style={{ marginBottom: 12 }}>
                <label className="cv-section-label" style={{ margin: 0 }}>Langues</label>
                <button className="cv-add-btn" onClick={addLangue}><Plus size={14} /> Ajouter</button>
              </div>
              {formData.langues.map((l, i) => (
                <div key={i} className="cv-langue-row">
                  <input value={l.langue} onChange={e => updateLangue(i, 'langue', e.target.value)} placeholder="Français" />
                  <select value={l.niveau} onChange={e => updateLangue(i, 'niveau', e.target.value)}>
                    {NIVEAUX_LANGUE.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {formData.langues.length > 1 && <button className="cv-remove-btn" onClick={() => removeLangue(i)}><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
            <div className="cv-section-block">
              <label className="cv-section-label">Centres d&apos;intérêt (optionnel)</label>
              <input value={formData.centresInteret} onChange={e => updateField('centresInteret', e.target.value)} placeholder="Voyages, Photographie, Open Source..." />
            </div>
          </div>
        )}

        {/* ── STEP 5 ── */}
        {step === 5 && (
          <div className="cv-step fade-in">
            <h2>Choisissez votre template</h2>
            <div className="cv-template-grid">
              {[
                { id: 'moderne', label: 'Moderne', desc: 'Sidebar colorée, design contemporain', color: '#1a3a6b' },
                { id: 'classique', label: 'Classique', desc: 'Layout traditionnel, sobre et formel', color: '#1a1a1a' },
                { id: 'minimaliste', label: 'Minimaliste', desc: 'Épuré, typographie fine, espace blanc', color: '#666666' },
              ].map(t => (
                <button
                  key={t.id}
                  className={`cv-template-card ${formData.template === t.id ? 'active' : ''}`}
                  onClick={() => updateField('template', t.id)}
                >
                  <div className="cv-template-preview" style={{ borderTopColor: t.color }}>
                    <div className="cv-template-mock">
                      {t.id === 'moderne' && <><div className="mock-sidebar" /><div className="mock-content"><div className="mock-line w80" /><div className="mock-line w60" /><div className="mock-line w90" /><div className="mock-line w40" /></div></>}
                      {t.id === 'classique' && <div className="mock-classic"><div className="mock-line-c w50" /><div className="mock-line-c w30" /><div className="mock-sep" /><div className="mock-line-c w80" /><div className="mock-line-c w60" /><div className="mock-sep" /><div className="mock-line-c w70" /></div>}
                      {t.id === 'minimaliste' && <div className="mock-minimal"><div className="mock-col"><div className="mock-line w80" /><div className="mock-line w50" /></div><div className="mock-col"><div className="mock-line w70" /><div className="mock-line w90" /><div className="mock-line w40" /></div></div>}
                    </div>
                  </div>
                  <div className="cv-template-label">{t.label}</div>
                  <div className="cv-template-desc">{t.desc}</div>
                  {formData.template === t.id && <div className="cv-template-check"><Check size={14} /></div>}
                </button>
              ))}
            </div>
            <button className="cv-generate-btn" onClick={generateCV} disabled={isGenerating || !formData.prenom || !formData.nom}>
              {isGenerating ? (<><div className="spinner-white" /> Génération en cours...</>) : (<><Sparkles size={16} /> Générer mon CV avec l&apos;IA</>)}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="cv-nav">
        {step > 1 && <button className="cv-nav-btn cv-nav-prev" onClick={() => setStep(s => s - 1)}><ChevronLeft size={16} /> Précédent</button>}
        <div style={{ flex: 1 }} />
        {step < 5 && <button className="cv-nav-btn cv-nav-next" onClick={() => setStep(s => s + 1)}>Suivant <ChevronRight size={16} /></button>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   CV TEMPLATES
   ═══════════════════════════════════════════════════ */

function CvModerne({ cv }) {
  const allSkills = [...(cv.competencesTech || []), ...(cv.competencesSoft || []), ...(cv.competences_suggerees || [])]
  return (
    <div className="cv-render cv-modern">
      <div className="cv-modern-sidebar">
        {cv.photo && <img src={cv.photo} alt="" className="cv-modern-photo" />}
        <div className="cv-modern-contact">
          <h3>Contact</h3>
          {cv.email && <p>{cv.email}</p>}
          {cv.telephone && <p>{cv.telephone}</p>}
          {(cv.ville || cv.pays) && <p>{[cv.ville, cv.pays].filter(Boolean).join(', ')}</p>}
          {cv.linkedin && <p>{cv.linkedin}</p>}
          {cv.github && <p>{cv.github}</p>}
          {cv.siteWeb && <p>{cv.siteWeb}</p>}
        </div>
        {allSkills.length > 0 && (
          <div className="cv-modern-section">
            <h3>Compétences</h3>
            <div className="cv-modern-skills">{allSkills.map((s, i) => <span key={i}>{s}</span>)}</div>
          </div>
        )}
        {cv.langues?.filter(l => l.langue).length > 0 && (
          <div className="cv-modern-section">
            <h3>Langues</h3>
            {cv.langues.filter(l => l.langue).map((l, i) => <p key={i}><strong>{l.langue}</strong> — {l.niveau}</p>)}
          </div>
        )}
        {cv.centresInteret && (
          <div className="cv-modern-section">
            <h3>Intérêts</h3>
            <p>{cv.centresInteret}</p>
          </div>
        )}
      </div>
      <div className="cv-modern-main">
        <h1>{cv.prenom} {cv.nom}</h1>
        <h2>{cv.titre}</h2>
        {cv.phrase_accroche && <p className="cv-accroche">{cv.phrase_accroche}</p>}
        {(cv.resume_ameliore || cv.resume) && (
          <div className="cv-section">
            <h3>Profil</h3>
            <p>{cv.resume_ameliore || cv.resume}</p>
          </div>
        )}
        {cv.experiences?.length > 0 && (
          <div className="cv-section">
            <h3>Expériences</h3>
            {cv.experiences.map((exp, i) => (
              <div key={i} className="cv-exp-item">
                <div className="cv-exp-header">
                  <strong>{exp.poste}</strong>
                  <span>{exp.dateDebut} — {exp.posteActuel ? 'Présent' : exp.dateFin}</span>
                </div>
                <div className="cv-exp-company">{exp.entreprise}{exp.ville ? `, ${exp.ville}` : ''}</div>
                {exp.description_amelioree?.length > 0 ? (
                  <ul>{exp.description_amelioree.map((b, j) => <li key={j}>{b.replace(/^[•\-]\s*/, '')}</li>)}</ul>
                ) : exp.description ? <p>{exp.description}</p> : null}
              </div>
            ))}
          </div>
        )}
        {cv.formations?.length > 0 && (
          <div className="cv-section">
            <h3>Formation</h3>
            {cv.formations.map((f, i) => (
              <div key={i} className="cv-edu-item">
                <strong>{f.diplome}</strong>{f.mention ? ` — ${f.mention}` : ''}
                <div>{f.etablissement} | {f.annee}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CvClassique({ cv }) {
  const allSkills = [...(cv.competencesTech || []), ...(cv.competencesSoft || []), ...(cv.competences_suggerees || [])]
  return (
    <div className="cv-render cv-classic">
      {cv.photo && <img src={cv.photo} alt="" className="cv-classic-photo" />}
      <h1>{cv.prenom} {cv.nom}</h1>
      <h2>{cv.titre}</h2>
      <div className="cv-classic-contact">
        {[cv.email, cv.telephone, [cv.ville, cv.pays].filter(Boolean).join(', ')].filter(Boolean).join('  •  ')}
      </div>
      {cv.phrase_accroche && <p className="cv-classic-accroche">{cv.phrase_accroche}</p>}
      <hr />
      {(cv.resume_ameliore || cv.resume) && (<><h3>Profil professionnel</h3><p>{cv.resume_ameliore || cv.resume}</p><hr /></>)}
      {cv.experiences?.length > 0 && (
        <><h3>Expériences professionnelles</h3>
        {cv.experiences.map((exp, i) => (
          <div key={i} className="cv-classic-exp">
            <div className="cv-classic-exp-head"><strong>{exp.poste}</strong> — {exp.entreprise}<span>{exp.dateDebut} – {exp.posteActuel ? 'Présent' : exp.dateFin}</span></div>
            {exp.description_amelioree?.length > 0 ? (
              <ul>{exp.description_amelioree.map((b, j) => <li key={j}>{b.replace(/^[•\-]\s*/, '')}</li>)}</ul>
            ) : exp.description ? <p>{exp.description}</p> : null}
          </div>
        ))}<hr /></>
      )}
      {cv.formations?.length > 0 && (
        <><h3>Formation</h3>
        {cv.formations.map((f, i) => (
          <div key={i} className="cv-classic-edu"><strong>{f.diplome}</strong>{f.mention ? ` (${f.mention})` : ''} — {f.etablissement}, {f.annee}</div>
        ))}<hr /></>
      )}
      {allSkills.length > 0 && (<><h3>Compétences</h3><p>{allSkills.join('  •  ')}</p><hr /></>)}
      {cv.langues?.filter(l => l.langue).length > 0 && (
        <><h3>Langues</h3><p>{cv.langues.filter(l => l.langue).map(l => `${l.langue} (${l.niveau})`).join('  •  ')}</p></>
      )}
    </div>
  )
}

function CvMinimaliste({ cv }) {
  const allSkills = [...(cv.competencesTech || []), ...(cv.competencesSoft || []), ...(cv.competences_suggerees || [])]
  return (
    <div className="cv-render cv-minimal">
      <div className="cv-minimal-header">
        {cv.photo && <img src={cv.photo} alt="" className="cv-minimal-photo" />}
        <div>
          <h1>{cv.prenom} {cv.nom}</h1>
          <h2>{cv.titre}</h2>
          {cv.phrase_accroche && <p className="cv-minimal-accroche">{cv.phrase_accroche}</p>}
        </div>
      </div>
      <div className="cv-minimal-body">
        <div className="cv-minimal-left">
          {(cv.resume_ameliore || cv.resume) && (<div className="cv-minimal-sec"><h3>Profil</h3><p>{cv.resume_ameliore || cv.resume}</p></div>)}
          {cv.experiences?.length > 0 && (
            <div className="cv-minimal-sec"><h3>Expériences</h3>
            {cv.experiences.map((exp, i) => (
              <div key={i} className="cv-minimal-exp">
                <strong>{exp.poste}</strong>
                <div className="cv-minimal-meta">{exp.entreprise} · {exp.dateDebut} – {exp.posteActuel ? 'Présent' : exp.dateFin}</div>
                {exp.description_amelioree?.length > 0 ? (
                  <ul>{exp.description_amelioree.map((b, j) => <li key={j}>{b.replace(/^[•\-]\s*/, '')}</li>)}</ul>
                ) : exp.description ? <p>{exp.description}</p> : null}
              </div>
            ))}</div>
          )}
          {cv.formations?.length > 0 && (
            <div className="cv-minimal-sec"><h3>Formation</h3>
            {cv.formations.map((f, i) => (
              <div key={i} className="cv-minimal-edu"><strong>{f.diplome}</strong>{f.mention ? ` — ${f.mention}` : ''}<div className="cv-minimal-meta">{f.etablissement} · {f.annee}</div></div>
            ))}</div>
          )}
        </div>
        <div className="cv-minimal-right">
          <div className="cv-minimal-sec"><h3>Contact</h3>
            {cv.email && <p>{cv.email}</p>}
            {cv.telephone && <p>{cv.telephone}</p>}
            {(cv.ville || cv.pays) && <p>{[cv.ville, cv.pays].filter(Boolean).join(', ')}</p>}
            {cv.linkedin && <p>{cv.linkedin}</p>}
            {cv.github && <p>{cv.github}</p>}
          </div>
          {allSkills.length > 0 && (<div className="cv-minimal-sec"><h3>Compétences</h3>{allSkills.map((s, i) => <p key={i}>{s}</p>)}</div>)}
          {cv.langues?.filter(l => l.langue).length > 0 && (<div className="cv-minimal-sec"><h3>Langues</h3>{cv.langues.filter(l => l.langue).map((l, i) => <p key={i}><strong>{l.langue}</strong> — {l.niveau}</p>)}</div>)}
          {cv.centresInteret && (<div className="cv-minimal-sec"><h3>Intérêts</h3><p>{cv.centresInteret}</p></div>)}
        </div>
      </div>
    </div>
  )
}

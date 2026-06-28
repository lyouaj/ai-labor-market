import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

/* ── Country code mapping for Adzuna ────────────────── */
const COUNTRY_CODES = {
  'France': 'fr', 'Allemagne': 'de', 'Royaume-Uni': 'gb',
  'États-Unis': 'us', 'Canada': 'ca', 'Espagne': 'es',
  'Italie': 'it', 'Pays-Bas': 'nl', 'Belgique': 'be',
  'Suisse': 'ch', 'Australie': 'au', 'Brésil': 'br',
  'Inde': 'in', 'Pologne': 'pl', 'Autriche': 'at',
  'Mexique': 'mx', 'Singapour': 'sg', 'Russie': 'ru',
  'Afrique du Sud': 'za', 'Nouvelle-Zélande': 'nz',
}

/* ── Build prompt for AI ───────────────────────────── */
function buildPrompt(profile) {
  return `Tu es un conseiller carrière expert en marché du travail international.

Voici le profil du candidat :
- Niveau d'études : ${profile.niveau}
- Diplôme : ${profile.diplome}
- Année d'obtention : ${profile.anneeObtention}
- Compétences : ${profile.competences.join(', ')}
- Années d'expérience : ${profile.experience}
- Langues : ${profile.langues.join(', ')}
- Disponibilité : ${profile.disponibilite}
- Type de travail souhaité : ${profile.typeTravail}
- Pays cible : ${profile.paysCible}

Analyse ce profil et retourne UNIQUEMENT un JSON valide (sans texte autour) avec cette structure exacte :
{
  "secteurs": ["secteur1", "secteur2", "secteur3"],
  "domaines": ["domaine1", "domaine2", "domaine3"],
  "pays": ["pays1", "pays2", "pays3"],
  "competencesAcquerir": ["compétence1", "compétence2", "compétence3", "compétence4"],
  "conseil": "Un paragraphe de conseil personnalisé détaillé pour ce candidat."
}

IMPORTANT : Retourne UNIQUEMENT le JSON, sans markdown, sans explication.`
}

/* ══════════════════════════════════════════════════════
   Gemini handler for recommendations
   ══════════════════════════════════════════════════════ */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'votre_clé_gemini_ici') {
    throw new Error('Clé API Gemini non configurée. Ajoutez GEMINI_API_KEY dans .env.local.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
  })

  const result = await model.generateContent(prompt)
  const response = await result.response
  const raw = response.text()

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Gemini raw response:', raw.substring(0, 500))
    throw new Error("Impossible d'extraire le JSON de la réponse Gemini")
  }

  return JSON.parse(jsonMatch[0])
}

/* ══════════════════════════════════════════════════════
   Ollama handler for recommendations
   ══════════════════════════════════════════════════════ */
async function callOllama(prompt, modelName = 'llama3.1') {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300000) // 5 min timeout (model loading on CPU is slow)

  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false,
        options: { temperature: 0.7 }
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Ollama a répondu avec le status ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const raw = data.response || ''

    // Extract JSON from response (handle possible markdown wrapping)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Ollama raw response:', raw.substring(0, 500))
      throw new Error("Impossible d'extraire le JSON de la réponse Ollama")
    }

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Ollama a mis trop de temps à répondre (timeout 2min)')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/* ── Fetch jobs from Adzuna ─────────────────────────── */
async function fetchAdzunaJobs(domaine, paysCible) {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) {
    console.warn('Adzuna API credentials missing')
    return []
  }

  // Determine country code
  const code = COUNTRY_CODES[paysCible] || 'fr'

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${code}/search/1`)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('what', domaine)
  url.searchParams.set('results_per_page', '5')

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } })
    if (!res.ok) {
      console.warn(`Adzuna responded with ${res.status} for ${domaine} in ${code}`)
      return []
    }
    const data = await res.json()
    return (data.results || []).map(job => ({
      titre: job.title || '',
      entreprise: job.company?.display_name || 'Non spécifié',
      lieu: job.location?.display_name || '',
      url: job.redirect_url || '',
      salaire: job.salary_is_predicted === '0' && job.salary_min
        ? `${Math.round(job.salary_min).toLocaleString()} - ${Math.round(job.salary_max).toLocaleString()}`
        : null,
      date: job.created ? new Date(job.created).toLocaleDateString('fr-FR') : '',
    }))
  } catch (err) {
    console.error('Adzuna fetch error:', err.message)
    return []
  }
}

/* ── POST handler ───────────────────────────────────── */
export async function POST(request) {
  try {
    const body = await request.json()
    const { model = 'ollama-fast', ...profile } = body

    // Validate required fields
    const required = ['email', 'niveau', 'diplome', 'anneeObtention', 'competences', 'experience', 'langues', 'disponibilite', 'typeTravail', 'paysCible']
    for (const field of required) {
      if (!profile[field]) {
        return NextResponse.json(
          { error: `Le champ "${field}" est requis.` },
          { status: 400 }
        )
      }
    }

    // 1. Get AI recommendations
    let aiResult
    try {
      const prompt = buildPrompt(profile)
      if (model === 'gemini') {
        aiResult = await callGemini(prompt)
      } else if (model === 'ollama-fast') {
        aiResult = await callOllama(prompt, 'llama3.2:1b')
      } else {
        // model === 'ollama' (Llama 3.1)
        aiResult = await callOllama(prompt, 'llama3.1')
      }
    } catch (err) {
      console.error('AI error:', err.message)
      return NextResponse.json(
        { error: `Impossible de contacter le service IA. ${err.message}` },
        { status: 503 }
      )
    }

    // 2. Fetch real job offers from Adzuna
    const searchTerm = aiResult.domaines?.[0] || profile.competences[0] || 'developer'
    const offres = await fetchAdzunaJobs(searchTerm, profile.paysCible)

    return NextResponse.json({
      secteurs: aiResult.secteurs || [],
      domaines: aiResult.domaines || [],
      pays: aiResult.pays || [],
      competencesAcquerir: aiResult.competencesAcquerir || [],
      conseil: aiResult.conseil || '',
      offres,
    })
  } catch (err) {
    console.error('Recommend API error:', err)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.' },
      { status: 500 }
    )
  }
}

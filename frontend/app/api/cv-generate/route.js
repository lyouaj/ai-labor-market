import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate'

function buildPrompt(formData) {
  return `Tu es un expert RH et rédacteur de CV professionnel.
Voici les données brutes d'un candidat :

Nom: ${formData.prenom} ${formData.nom}
Titre: ${formData.titre}
Résumé actuel: ${formData.resume || 'Aucun'}
Expériences: ${JSON.stringify(formData.experiences || [])}
Formations: ${JSON.stringify(formData.formations || [])}
Compétences techniques: ${(formData.competencesTech || []).join(', ')}
Compétences soft: ${(formData.competencesSoft || []).join(', ')}
Langues: ${JSON.stringify(formData.langues || [])}

Retourne UNIQUEMENT un JSON valide (sans markdown, sans texte autour, sans backticks) avec cette structure exacte :
{
  "resume": "Résumé professionnel amélioré et percutant (3-4 phrases avec verbes d'action)",
  "experiences": [
    {
      "index": 0,
      "description_amelioree": ["• Bullet point 1 avec verbe d'action", "• Bullet point 2", "• Bullet point 3"]
    }
  ],
  "competences_suggerees": ["compétence1", "compétence2", "compétence3"],
  "phrase_accroche": "Une phrase d'accroche personnalisée et impactante pour le haut du CV"
}

IMPORTANT:
- Améliore et professionnalise le résumé professionnel
- Reformule CHAQUE description d'expérience en bullet points percutants avec des verbes d'action (Développé, Optimisé, Géré, Piloté, Conçu, Implémenté...)
- Suggère 3 compétences supplémentaires pertinentes par rapport au profil
- Génère une phrase d'accroche personnalisée
- Corrige toutes les fautes d'orthographe
- Le tableau "experiences" doit contenir un objet pour CHAQUE expérience du candidat, avec l'index correspondant
- Retourne UNIQUEMENT le JSON, rien d'autre`
}

/* ── Parse AI JSON response ──────────────────────────── */
function parseAIResponse(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return null
  }
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

/* ── Enrich formData with AI result ──────────────────── */
function enrichFormData(formData, aiResult) {
  return {
    ...formData,
    resume_ameliore: aiResult.resume || formData.resume,
    phrase_accroche: aiResult.phrase_accroche || '',
    competences_suggerees: aiResult.competences_suggerees || [],
    experiences: (formData.experiences || []).map((exp, i) => {
      const aiExp = (aiResult.experiences || []).find(e => e.index === i)
      return {
        ...exp,
        description_amelioree: aiExp?.description_amelioree || [],
      }
    }),
  }
}

/* ══════════════════════════════════════════════════════
   Gemini handler for CV generation
   ══════════════════════════════════════════════════════ */
async function handleGemini(prompt) {
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
  return response.text()
}

/* ══════════════════════════════════════════════════════
   Ollama handler for CV generation
   ══════════════════════════════════════════════════════ */
async function handleOllama(prompt, modelName = 'llama3.1') {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300000)

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.7 },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Ollama erreur ${res.status}: ${errText}`)
    }

    const data = await res.json()
    return data.response || ''
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Ollama a mis trop de temps à répondre (timeout 5min).')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/* ══════════════════════════════════════════════════════
   POST handler
   ══════════════════════════════════════════════════════ */
export async function POST(request) {
  try {
    const body = await request.json()
    const { model = 'ollama-fast', ...formData } = body

    const prompt = buildPrompt(formData)

    let raw
    try {
      if (model === 'gemini') {
        raw = await handleGemini(prompt)
      } else if (model === 'ollama-fast') {
        raw = await handleOllama(prompt, 'llama3.2:1b')
      } else {
        // model === 'ollama' (Llama 3.1)
        raw = await handleOllama(prompt, 'llama3.1')
      }
    } catch (err) {
      const isConnection = err.message?.includes('contacter') || err.message?.includes('ECONNREFUSED')
      return NextResponse.json(
        { error: err.message || 'Impossible de contacter le service IA.' },
        { status: isConnection ? 503 : 502 }
      )
    }

    // Parse AI response
    const aiResult = parseAIResponse(raw)
    if (!aiResult) {
      console.error('[CV Generate] Raw:', (raw || '').substring(0, 500))
      return NextResponse.json(
        { error: "Impossible d'extraire le JSON de la réponse IA. Réessayez." },
        { status: 500 }
      )
    }

    // Merge AI enhancements with original data
    const enriched = enrichFormData(formData, aiResult)

    return NextResponse.json({ cv: enriched })
  } catch (err) {
    console.error('[CV Generate] Error:', err)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.' },
      { status: 500 }
    )
  }
}

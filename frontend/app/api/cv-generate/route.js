import { NextResponse } from 'next/server'

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

export async function POST(request) {
  try {
    const formData = await request.json()

    const prompt = buildPrompt(formData)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 300000)

    let ollamaRes
    try {
      ollamaRes = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1',
          prompt,
          stream: false,
          format: 'json',
          options: { temperature: 0.7 },
        }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeout)
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Ollama a mis trop de temps à répondre (timeout 5min).' },
          { status: 504 }
        )
      }
      return NextResponse.json(
        { error: 'Impossible de contacter Ollama. Vérifiez qu\'il est lancé sur localhost:11434.' },
        { status: 503 }
      )
    }

    clearTimeout(timeout)

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text().catch(() => '')
      return NextResponse.json(
        { error: `Ollama erreur ${ollamaRes.status}: ${errText}` },
        { status: 502 }
      )
    }

    const data = await ollamaRes.json()
    const raw = data.response || ''

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[CV Generate] Raw:', raw.substring(0, 500))
      return NextResponse.json(
        { error: 'Impossible d\'extraire le JSON de la réponse IA.' },
        { status: 500 }
      )
    }

    let aiResult
    try {
      aiResult = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[CV Generate] JSON parse failed:', jsonMatch[0].substring(0, 300))
      return NextResponse.json(
        { error: 'La réponse IA n\'est pas un JSON valide. Réessayez.' },
        { status: 500 }
      )
    }

    // Merge AI enhancements with original data
    const enriched = {
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

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('[CV Generate] Error:', err)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.' },
      { status: 500 }
    )
  }
}

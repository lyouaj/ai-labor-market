import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434/api/chat'
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'

const SYSTEM_PROMPT_BASE = `Tu es Jobly, un agent expert en marché du travail mondial.
Tu analyses les licenciements, tendances d'emploi, secteurs porteurs et conseilles les utilisateurs sur leur carrière.
Tu réponds UNIQUEMENT aux questions liées à l'emploi, marché du travail, compétences, secteurs, pays et carrière.
Si une question est hors sujet, réponds poliment :
"Je suis Jobly, spécialisé dans le marché du travail. Je ne peux pas répondre à cette question."
Tu utilises les données réelles fournies dans le contexte pour répondre avec précision et des chiffres concrets.
Réponds toujours en français sauf si l'utilisateur pose sa question dans une autre langue.`

/* ── Fetch context from FastAPI backend ─────────────── */
async function fetchBackendContext() {
  const results = { summary: null, metrics: null, news: null, worldEconomy: null }

  try {
    const [summaryRes, metricsRes, newsRes, weRes] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/summary`, { cache: 'no-store' }),
      fetch(`${BACKEND_URL}/metrics`, { cache: 'no-store' }),
      fetch(`${BACKEND_URL}/trending-news`, { cache: 'no-store' }),
      fetch(`${BACKEND_URL}/world-economy`, { cache: 'no-store' }),
    ])

    if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
      results.summary = await summaryRes.value.json()
    }
    if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
      results.metrics = await metricsRes.value.json()
    }
    if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
      results.news = await newsRes.value.json()
    }
    if (weRes.status === 'fulfilled' && weRes.value.ok) {
      results.worldEconomy = await weRes.value.json()
    }
  } catch (err) {
    console.warn('[Jobly] Could not fetch backend context:', err.message)
  }

  return results
}

/* ── Build enriched system prompt ───────────────────── */
function buildSystemPrompt(context, fileContent) {
  let prompt = SYSTEM_PROMPT_BASE

  const dataParts = []

  if (context.summary) {
    const s = context.summary
    dataParts.push(
      `Total licenciements enregistrés : ${s.total_laid_off?.toLocaleString() ?? 'N/A'}`,
      `Nombre d'événements : ${s.total_events?.toLocaleString() ?? 'N/A'}`,
      `Entreprises touchées : ${s.unique_companies?.toLocaleString() ?? 'N/A'}`,
      `Pays concernés : ${s.unique_countries ?? 'N/A'}`,
    )
    if (s.top_countries) dataParts.push(`Top pays : ${JSON.stringify(s.top_countries)}`)
    if (s.top_industries) dataParts.push(`Top secteurs : ${JSON.stringify(s.top_industries)}`)
  }

  if (context.metrics) {
    const m = context.metrics
    dataParts.push(
      `Métriques modèle ML — MAE trimestriel : ${m.MAE_quarterly ?? 'N/A'}, MAPE : ${m.MAPE_quarterly ?? 'N/A'}, R² : ${m.R2_quarterly ?? 'N/A'}`,
      `Dernier entraînement : ${m.last_trained ?? 'N/A'}`,
    )
  }

  if (context.news && context.news.articles) {
    const actus = context.news.articles.map(a => `- ${a.title} (${a.source})`).join('\n')
    dataParts.push(`Actualités récentes du marché de l'emploi :\n${actus}`)
  }

  if (context.worldEconomy && context.worldEconomy.data) {
    const topChomage = context.worldEconomy.data.slice(0, 10).map(c => `${c.country}: ${c.unemployment_rate}%`).join(', ')
    dataParts.push(`Taux de chômage mondial (Top 10 les plus élevés) : ${topChomage}`)
  }

  if (dataParts.length > 0) {
    prompt += `\n\nDonnées actuelles du site :\n${dataParts.join('\n')}`
  }

  if (fileContent) {
    prompt += `\n\nL'utilisateur a partagé ce document, analyse-le dans le contexte du marché du travail :\n${fileContent}`
  }

  return prompt
}

/* ── Extract text from uploaded PDF ─────────────────── */
async function extractPdfText(base64Data) {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const buffer = Buffer.from(base64Data, 'base64')
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch (err) {
    console.error('[Jobly] PDF parse error:', err.message)
    return '[Erreur : impossible de lire le PDF]'
  }
}

/* ══════════════════════════════════════════════════════
   Gemini Flash streaming handler
   ══════════════════════════════════════════════════════ */
async function handleGemini(systemPrompt, messages) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'votre_clé_gemini_ici') {
    return NextResponse.json(
      { error: 'Clé API Gemini non configurée. Ajoutez GEMINI_API_KEY dans .env.local.' },
      { status: 503 }
    )
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    })

    // Build Gemini chat history (all messages except the last user message)
    const history = []
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i]
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1]?.content || ''

    const result = await chat.sendMessageStream(lastMessage)

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(new TextEncoder().encode(text))
            }
          }
        } catch (err) {
          console.error('[Jobly/Gemini] Stream error:', err.message)
          // If nothing was streamed yet, enqueue an error message
          controller.enqueue(
            new TextEncoder().encode(`\n\n⚠️ Erreur Gemini : ${err.message}`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[Jobly/Gemini] Error:', err)
    const msg = err.message?.includes('quota')
      ? 'Quota Gemini dépassé. Réessayez plus tard ou passez sur Llama 3.1.'
      : `Erreur Gemini : ${err.message}`
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

/* ══════════════════════════════════════════════════════
   Ollama (Llama 3.1) streaming handler
   ══════════════════════════════════════════════════════ */
async function handleOllama(systemPrompt, messages) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300000) // 5 min

  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ]

  let ollamaRes
  try {
    ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1',
        messages: ollamaMessages,
        stream: true,
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

  if (!ollamaRes.ok) {
    clearTimeout(timeout)
    const errText = await ollamaRes.text().catch(() => '')
    return NextResponse.json(
      { error: `Ollama a répondu avec le status ${ollamaRes.status}: ${errText}` },
      { status: 502 }
    )
  }

  const stream = new ReadableStream({
    async start(streamController) {
      const reader = ollamaRes.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter(l => l.trim())

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line)
              if (parsed.message?.content) {
                streamController.enqueue(
                  new TextEncoder().encode(parsed.message.content)
                )
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (err) {
        console.error('[Jobly/Ollama] Stream read error:', err.message)
      } finally {
        clearTimeout(timeout)
        streamController.close()
        reader.releaseLock()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

/* ══════════════════════════════════════════════════════
   POST handler
   ══════════════════════════════════════════════════════ */
export async function POST(request) {
  try {
    const body = await request.json()
    const { messages = [], fileContent, fileBase64, fileType, model = 'gemini' } = body

    // Extract text from PDF if uploaded
    let processedFileContent = fileContent || null
    if (fileBase64 && fileType === 'application/pdf') {
      processedFileContent = await extractPdfText(fileBase64)
    }

    // Fetch real-time context from backend
    const context = await fetchBackendContext()

    // Build system prompt
    const systemPrompt = buildSystemPrompt(context, processedFileContent)

    // Route to the selected model
    if (model === 'ollama') {
      return handleOllama(systemPrompt, messages)
    } else {
      return handleGemini(systemPrompt, messages)
    }
  } catch (err) {
    console.error('[Jobly] API error:', err)
    return NextResponse.json(
      { error: 'Erreur interne du serveur.' },
      { status: 500 }
    )
  }
}

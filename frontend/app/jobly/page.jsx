'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Bot, Send, Paperclip, X, Sparkles, ArrowRight, Globe, Cpu, Save, CheckCircle2 } from 'lucide-react'

const SUGGESTIONS = [
  'Quels secteurs licencient le plus en 2026 ?',
  'Quel pays a le moins de licenciements ?',
  'Analyse mon CV et conseille-moi',
  'Quelles compétences sont les plus demandées ?',
]

export default function JoblyPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [selectedModel, setSelectedModel] = useState('gemini')
  const [savedChat, setSavedChat] = useState(false)
  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSend(text) {
    const messageText = text || input.trim()
    if (!messageText && !uploadedFile) return
    if (isLoading) return

    const userMsg = {
      role: 'user',
      content: uploadedFile
        ? `${messageText}\n\n📎 Fichier joint : ${uploadedFile.name}`
        : messageText,
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setSavedChat(false) // Reset save state on new message

    const body = {
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      model: selectedModel,
    }

    if (uploadedFile) {
      if (uploadedFile.type === 'application/pdf') {
        body.fileBase64 = uploadedFile.base64
        body.fileType = 'application/pdf'
      } else {
        body.fileContent = uploadedFile.textContent
      }
      setUploadedFile(null)
    }

    const botMsgIndex = newMessages.length
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/jobly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Erreur ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const current = accumulated
        setMessages(prev => {
          const updated = [...prev]
          updated[botMsgIndex] = { role: 'assistant', content: current }
          return updated
        })
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[botMsgIndex] = {
          role: 'assistant',
          content: `⚠️ ${err.message || 'Erreur de connexion. Vérifiez la configuration.'}`,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['application/pdf', 'text/plain']
    if (!allowedTypes.includes(file.type)) {
      alert('Seuls les fichiers PDF et .txt sont acceptés.')
      return
    }

    if (file.type === 'application/pdf') {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        setUploadedFile({ name: file.name, type: file.type, base64 })
      }
      reader.readAsDataURL(file)
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        setUploadedFile({ name: file.name, type: file.type, textContent: reader.result })
      }
      reader.readAsText(file)
    }

    e.target.value = ''
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSaveChat = async () => {
    if (!session) {
      alert("Veuillez vous connecter pour sauvegarder cette conversation.")
      return
    }
    try {
      const res = await fetch('/api/user/jobly-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel, messages })
      })
      if (res.ok) setSavedChat(true)
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la conversation')
    }
  }

  const showWelcome = messages.length === 0

  return (
    <div className="jobly-page">
      <div className="jobly-page-header">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="jobly-page-header-left">
            <div className="jobly-avatar-lg">
              <Bot size={24} />
            </div>
            <div>
              <h1>Jobly Agent</h1>
              <p>Votre assistant IA spécialisé dans le marché du travail.</p>
            </div>
          </div>
        </div>
        <div className="jobly-page-header-badge">
          <Sparkles size={12} />
          {selectedModel === 'gemini' ? 'Gemini Flash' : 'Llama 3.1'}
        </div>
      </div>

      {/* Model Toggle */}
      <div className="jobly-model-bar">
        <div className="jobly-model-toggle">
          <button
            className={`jobly-model-btn ${selectedModel === 'gemini' ? 'active' : ''}`}
            onClick={() => setSelectedModel('gemini')}
            disabled={isLoading}
          >
            <Globe size={14} />
            <span>Gemini Flash</span>
            <span className="jobly-model-badge jobly-model-badge-green">Rapide</span>
          </button>
          <button
            className={`jobly-model-btn ${selectedModel === 'ollama' ? 'active' : ''}`}
            onClick={() => setSelectedModel('ollama')}
            disabled={isLoading}
          >
            <Cpu size={14} />
            <span>Llama 3.1</span>
            <span className="jobly-model-badge jobly-model-badge-blue">Privé</span>
          </button>
        </div>
        <div className="jobly-model-desc">
          {selectedModel === 'gemini'
            ? 'Rapide · Nécessite internet'
            : 'Confidentiel · Fonctionne hors-ligne'}
        </div>
      </div>

      <div className="jobly-page-chat">
        {/* Welcome / Suggestions */}
        {showWelcome && (
          <div className="jobly-welcome fade-in">
            <div className="jobly-welcome-icon">
              <Bot size={32} />
            </div>
            <h2>Bonjour ! Je suis Jobly 👋</h2>
            <p>
              Je suis votre agent IA spécialisé dans l&apos;analyse du marché du travail mondial.
              Posez-moi vos questions sur les licenciements, les secteurs porteurs, les compétences
              recherchées, ou partagez votre CV pour des conseils personnalisés.
            </p>
            <div className="jobly-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="jobly-suggestion-btn"
                  onClick={() => handleSend(s)}
                >
                  <span>{s}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="jobly-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`jobly-msg ${msg.role === 'user' ? 'jobly-msg-user' : 'jobly-msg-bot'}`}>
              {msg.role === 'assistant' && (
                <div className="jobly-msg-avatar">
                  <Bot size={14} />
                </div>
              )}
              <div className="jobly-msg-bubble">
                <div className="jobly-msg-text">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="jobly-msg jobly-msg-bot">
              <div className="jobly-msg-avatar">
                <Bot size={14} />
              </div>
              <div className="jobly-msg-bubble">
                <div className="jobly-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="jobly-page-input-bar">
        {uploadedFile && (
          <div className="jobly-file-badge">
            <Paperclip size={12} />
            <span>{uploadedFile.name}</span>
            <button onClick={() => setUploadedFile(null)}><X size={12} /></button>
          </div>
        )}
        <div className="jobly-input-row">
          <button
            className="jobly-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Joindre un fichier (PDF ou .txt)"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={inputRef}
            type="text"
            placeholder="Posez votre question sur le marché du travail..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="jobly-upload-btn"
            onClick={handleSaveChat}
            disabled={savedChat || isLoading || messages.length === 0}
            title={savedChat ? "Conversation sauvegardée" : "Sauvegarder la conversation"}
            style={{ color: savedChat ? 'var(--success)' : 'inherit', marginLeft: 'auto' }}
          >
            {savedChat ? <CheckCircle2 size={16} /> : <Save size={16} />}
          </button>
          <button
            className="jobly-send-btn"
            onClick={() => handleSend()}
            disabled={isLoading || (!input.trim() && !uploadedFile)}
          >
            <Send size={16} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,text/plain,application/pdf"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}

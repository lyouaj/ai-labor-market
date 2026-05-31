'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, Send, Paperclip, X, ArrowRight, MessageCircle, Globe, Cpu } from 'lucide-react'

const SUGGESTIONS = [
  'Quels secteurs licencient le plus ?',
  'Compétences les plus demandées ?',
  'Conseils pour ma carrière',
  'Tendances du marché du travail',
]

export default function JoblyChat() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [selectedModel, setSelectedModel] = useState('gemini')
  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Don't render on /jobly page or landing page (AFTER all hooks)
  if (pathname === '/jobly' || pathname === '/') return null

  async function handleSend(text) {
    const messageText = text || input.trim()
    if (!messageText && !uploadedFile) return
    if (isLoading) return

    const userMsg = {
      role: 'user',
      content: uploadedFile
        ? `${messageText}\n\n📎 ${uploadedFile.name}`
        : messageText,
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

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
          content: `⚠️ ${err.message || 'Erreur de connexion.'}`,
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

  const showWelcome = messages.length === 0

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button className="jobly-fab" onClick={() => setIsOpen(true)}>
          <MessageCircle size={20} />
          <span>Jobly</span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="jobly-float-window">
          {/* Header */}
          <div className="jobly-float-header">
            <div className="jobly-float-header-left">
              <div className="jobly-avatar-sm">
                <Bot size={14} />
              </div>
              <div>
                <div className="jobly-float-title">Jobly</div>
                <div className="jobly-float-subtitle">Agent IA • Marché du travail</div>
              </div>
            </div>
            <button className="jobly-float-close" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          {/* Model Toggle — compact */}
          <div className="jobly-model-bar-compact">
            <button
              className={`jobly-model-btn-sm ${selectedModel === 'gemini' ? 'active' : ''}`}
              onClick={() => setSelectedModel('gemini')}
              disabled={isLoading}
            >
              <Globe size={11} />
              Gemini
              <span className="jobly-model-badge-sm jobly-model-badge-green">Rapide</span>
            </button>
            <button
              className={`jobly-model-btn-sm ${selectedModel === 'ollama' ? 'active' : ''}`}
              onClick={() => setSelectedModel('ollama')}
              disabled={isLoading}
            >
              <Cpu size={11} />
              Llama
              <span className="jobly-model-badge-sm jobly-model-badge-blue">Privé</span>
            </button>
          </div>

          {/* Chat Body */}
          <div className="jobly-float-body">
            {showWelcome && (
              <div className="jobly-float-welcome">
                <div className="jobly-float-welcome-icon">
                  <Bot size={22} />
                </div>
                <p>Bonjour ! Je suis <strong>Jobly</strong>, votre assistant marché du travail. Comment puis-je vous aider ?</p>
                <div className="jobly-float-suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      className="jobly-float-suggestion"
                      onClick={() => handleSend(s)}
                    >
                      {s}
                      <ArrowRight size={11} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`jobly-msg ${msg.role === 'user' ? 'jobly-msg-user' : 'jobly-msg-bot'}`}>
                {msg.role === 'assistant' && (
                  <div className="jobly-msg-avatar jobly-msg-avatar-sm">
                    <Bot size={11} />
                  </div>
                )}
                <div className="jobly-msg-bubble">
                  <div className="jobly-msg-text">{msg.content}</div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="jobly-msg jobly-msg-bot">
                <div className="jobly-msg-avatar jobly-msg-avatar-sm">
                  <Bot size={11} />
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

          {/* Input */}
          <div className="jobly-float-input">
            {uploadedFile && (
              <div className="jobly-file-badge jobly-file-badge-sm">
                <Paperclip size={10} />
                <span>{uploadedFile.name}</span>
                <button onClick={() => setUploadedFile(null)}><X size={10} /></button>
              </div>
            )}
            <div className="jobly-float-input-row">
              <button
                className="jobly-upload-btn-sm"
                onClick={() => fileInputRef.current?.click()}
                title="Joindre un fichier"
              >
                <Paperclip size={14} />
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="Votre question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                className="jobly-send-btn-sm"
                onClick={() => handleSend()}
                disabled={isLoading || (!input.trim() && !uploadedFile)}
              >
                <Send size={14} />
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
      )}
    </>
  )
}

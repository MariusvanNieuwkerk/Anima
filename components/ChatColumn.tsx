'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import SvgDisplay from './SvgDisplay';
import MapPane from './MapPane'
import MarkdownMessage from './MarkdownMessage'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Base64 image data voor preview in chat
  // Optional interactive map spec (OSM/Leaflet)
  map?: any
}

interface ChatColumnProps {
  messages: Message[];
  isTyping: boolean;
  renderImages?: boolean;
  renderSvgs?: boolean;
  renderMaps?: boolean;
  renderUploadThumbnails?: boolean;
}

export default function ChatColumn({
  messages,
  isTyping,
  renderImages = true,
  renderSvgs = true,
  renderMaps = true,
  renderUploadThumbnails = true,
}: ChatColumnProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isDataImage = (s: string) => /^data:image\//i.test(s || '')

  const renderTextWithInlineSvgs = (text: string, keyPrefix: string) => {
    const chunks = text.split(/(<svg[\s\S]*?<\/svg>)/gi)
    return chunks.map((chunk, idx) => {
      if (!chunk || !chunk.trim()) return null

      if (/^<svg[\s>]/i.test(chunk.trim())) {
        if (!renderSvgs) return null
        return <SvgDisplay key={`${keyPrefix}-svg-${idx}`} content={chunk} />
      }

      return (
        <div key={`${keyPrefix}-md-${idx}`} className="space-y-0">
          <MarkdownMessage content={chunk} />
        </div>
      )
    })
  }

  const renderContent = (content?: string) => {
    if (!content) return null

    const parts = content.split(/(```[\s\S]*?```)/g)

    return parts.map((part, index) => {
      if (!part || !part.trim()) return null

      const trimmed = part.trim()

      // Code block
      if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
        const inner = trimmed
          .replace(/^```[^\n]*\n?/, '')
          .replace(/```$/, '')
          .trim()

        // If it contains an SVG, render it
        if (/<svg[\s>]/i.test(inner)) {
          if (!renderSvgs) return null
          return <SvgDisplay key={`svg-${index}`} content={inner} />
        }

        // Otherwise show the code (debug)
        return (
          <pre key={`code-${index}`} className="whitespace-pre-wrap text-xs bg-white/70 border border-stone-200 rounded-lg p-3 overflow-x-auto">
            <code>{inner}</code>
          </pre>
        )
      }

      // Plain text (also supports inline <svg>...</svg> without code fences)
      return <Fragment key={`text-${index}`}>{renderTextWithInlineSvgs(part, `seg-${index}`)}</Fragment>
    })
  }

  const scrollToBottom = () => {
    const el = scrollAreaRef.current
    if (!el) return
    // Always scroll the *chat container* to the bottom.
    // This avoids the previous "stuck in the middle" behavior, while still not moving the page.
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
      // Some browsers/layouts need a second tick after images/fonts/layout settle.
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' })
      })
    })
  }

  const copyToClipboard = async (id: string, text: string) => {
    const t = String(text || '').trim()
    if (!t) return

    // If the user is selecting text, don't hijack the click.
    try {
      const selection = window.getSelection?.()?.toString?.() || ''
      if (selection.trim().length > 0) return
    } catch {
      // ignore
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(t)
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea')
        ta.value = t
        ta.style.position = 'fixed'
        ta.style.top = '0'
        ta.style.left = '0'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }

      setCopiedId(id)
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 900)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-stone-200 shadow-lg overflow-hidden">
      {/* Messages Area - IOS POLISH: overflow-y-auto met -webkit-overflow-scrolling voor soepel scrollen */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 bg-stone-50/30"
        style={{
          WebkitOverflowScrolling: 'touch',
          // Prevent browser scroll anchoring from jumping the page when content expands.
          overflowAnchor: 'none',
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User-upload thumbnails shown inline in chat stream (between messages) */}
            {renderUploadThumbnails && msg.role === 'user' && msg.images && msg.images.some(isDataImage) ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] flex flex-wrap gap-2">
                  {msg.images.filter(isDataImage).map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Upload ${index + 1}`}
                      className="h-16 w-16 rounded-xl object-cover border border-stone-200 shadow-sm bg-white"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`group relative max-w-[85%] p-4 md:p-5 rounded-3xl text-sm md:text-base leading-relaxed shadow-md hover:shadow-lg transition-shadow ${
                  msg.role === 'user' 
                    ? 'bg-white border border-stone-200 text-stone-800 rounded-tr-none hover:scale-[1.02] transition-transform' 
                    : 'bg-stone-100 text-stone-800 rounded-tl-none border border-transparent hover:scale-[1.02] transition-transform'
                }`}
              >
              {msg.content ? (
                <button
                  type="button"
                  aria-label="Kopieer bericht"
                  title="Kopieer"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard(msg.id, msg.content)
                  }}
                  className={[
                    // On touch devices: always visible. On larger screens: show on hover/focus.
                    'absolute top-2 right-2',
                    'h-8 w-8 rounded-full border border-stone-200 bg-white/80 backdrop-blur',
                    'flex items-center justify-center shadow-sm',
                    'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100',
                    'transition-opacity',
                    'hover:bg-white hover:shadow',
                    'text-stone-600 hover:text-stone-900',
                  ].join(' ')}
                >
                  {copiedId === msg.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              ) : null}

              {copiedId === msg.id ? (
                <div className="absolute -top-3 right-3 text-[11px] px-2 py-1 rounded-full bg-stone-900 text-white shadow">
                  Gekopieerd
                </div>
              ) : null}
              {renderMaps && msg.map ? (
                <div className={`${msg.content ? 'mb-3' : ''} h-[320px] max-w-[520px]`}>
                  <MapPane spec={msg.map} />
                </div>
              ) : null}

              {renderImages && msg.role === 'user' && msg.images && msg.images.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${msg.content ? 'mb-2' : ''}`}>
                  {msg.images.map((img, index) => (
                    <img 
                      key={index}
                      src={img} 
                      alt={`Upload ${index + 1}`}
                      className="max-w-[250px] max-h-[250px] rounded-lg object-cover border border-stone-200 shadow-sm"
                    />
                  ))}
                </div>
              )}
              {msg.content ? <div className="space-y-3">{renderContent(msg.content)}</div> : null}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-stone-100 px-4 py-3 rounded-3xl rounded-tl-none text-xs text-stone-500 flex items-center gap-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stone-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-stone-500"></span>
              </span>
              Anima denkt na...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

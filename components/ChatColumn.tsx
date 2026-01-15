import { Fragment, useEffect, useRef } from 'react'
import SvgDisplay from './SvgDisplay'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[] // Base64 image data voor preview in chat
}

interface ChatColumnProps {
  messages: Message[];
  isTyping: boolean;
}

export default function ChatColumn({ messages, isTyping }: ChatColumnProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const renderContent = (content: string) => {
    if (!content) return null

    // Split and keep the code blocks (capturing group)
    const parts = content.split(/(```(?:xml|svg)[\s\S]*?```)/gi)

    return parts.map((part, index) => {
      const trimmed = part.trim()
      if (!trimmed) return null

      if (/^```(?:xml|svg)/i.test(trimmed)) {
        const svgContent = trimmed
          .replace(/^```(?:xml|svg)\s*/i, '')
          .replace(/```$/i, '')
          .trim()
        return <SvgDisplay key={`svg-${index}`} content={svgContent} />
      }

      // Render regular text as paragraphs; keep line breaks inside paragraphs.
      const paragraphs = part.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean)
      return (
        <Fragment key={`text-${index}`}>
          {paragraphs.map((p, pIndex) => (
            <p key={`p-${index}-${pIndex}`} className="mb-2 last:mb-0 whitespace-pre-wrap">
              {p}
            </p>
          ))}
        </Fragment>
      )
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-stone-200 shadow-lg overflow-hidden">
      {/* Messages Area - IOS POLISH: overflow-y-auto met -webkit-overflow-scrolling voor soepel scrollen */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 bg-stone-50/30" style={{ WebkitOverflowScrolling: 'touch' }}>
        {messages.map((msg) => (
          <div
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`max-w-[85%] p-4 md:p-5 rounded-3xl text-sm md:text-base leading-relaxed shadow-md hover:shadow-lg transition-shadow ${
                msg.role === 'user' 
                  ? 'bg-white border border-stone-200 text-stone-800 rounded-tr-none hover:scale-[1.02] transition-transform' 
                  : 'bg-stone-100 text-stone-800 rounded-tl-none border border-transparent hover:scale-[1.02] transition-transform'
              }`}
            >
              {msg.images && msg.images.length > 0 && (
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

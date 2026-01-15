import { useEffect, useMemo, useRef } from 'react'
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

  const extractSvgBlock = useMemo(() => {
    return (content: string) => {
      if (!content) return null

      const match = content.match(/```(?:xml|svg)\s*([\s\S]*?)```/i)
      if (!match || !match[1]) return null

      const rawBlock = match[1].trim()
      // Prefer a real <svg>...</svg> payload if present
      const svgMatch = rawBlock.match(/<svg[\s\S]*?<\/svg>/i)
      const svg = (svgMatch ? svgMatch[0] : rawBlock).trim()
      if (!/^<svg[\s>]/i.test(svg)) return null

      const textWithout = content.replace(match[0], '').trim()
      return { svg, textWithout }
    }
  }, [])

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
              {msg.content && (() => {
                const svgBlock = extractSvgBlock(msg.content)
                if (!svgBlock) return <div>{msg.content}</div>

                return (
                  <div className="space-y-3">
                    {svgBlock.textWithout ? <div>{svgBlock.textWithout}</div> : null}
                    <SvgDisplay content={svgBlock.svg} />
                  </div>
                )
              })()}
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

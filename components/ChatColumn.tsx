import { useEffect, useRef } from 'react'

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-stone-200 shadow-lg overflow-hidden">
      {/* Messages Area - IOS STICKY FIX: Gebruik overflow-y-auto met -webkit-overflow-scrolling */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-stone-50/30" style={{ WebkitOverflowScrolling: 'touch' }}>
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
              {msg.content && <div>{msg.content}</div>}
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

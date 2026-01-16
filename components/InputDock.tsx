import { Paperclip, Mic, Send, Volume2, VolumeX } from 'lucide-react'
import { useMemo, useState } from 'react'

interface InputDockProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onAttachClick: () => void;
  onFiles?: (files: File[]) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onMicClick?: () => void;
  isListening?: boolean;
  isVoiceOn?: boolean;
  onVoiceToggle?: () => void;
  hasAttachment?: boolean;
}

export default function InputDock({ 
  input, 
  setInput, 
  onSend, 
  onAttachClick, 
  onFiles,
  inputRef,
  onMicClick,
  isListening = false,
  isVoiceOn = false,
  onVoiceToggle,
  hasAttachment = false
}: InputDockProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const canAcceptDrop = useMemo(() => {
    // Desktop users: allow dropping screenshot files. Mobile drag events are rare.
    return typeof onFiles === 'function'
  }, [onFiles])

  const extractImageFiles = (filesLike: FileList | File[]) => {
    const files = Array.isArray(filesLike) ? filesLike : Array.from(filesLike || [])
    return files.filter((f) => (f as any)?.type?.startsWith?.('image/'))
  }

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-3 bg-stone-50 p-2 md:p-[1.125rem] rounded-3xl border transition-all shadow-md ${
        isDragOver
          ? 'border-stone-600 border-dashed ring-2 ring-stone-200 shadow-lg'
          : isListening
            ? 'border-red-400 shadow-red-100 ring-2 ring-red-50'
            : 'border-stone-200 focus-within:border-stone-400 focus-within:shadow-lg'
      }`}
      onDragEnter={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
      }}
      onDragOver={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.stopPropagation()
        if (!isDragOver) setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
      }}
      onDrop={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        const dropped = extractImageFiles(e.dataTransfer?.files)
        if (dropped.length > 0) onFiles?.(dropped)
      }}
    >
      {/* Mobiel: Icoontjes rij boven */}
      <div className="flex items-center gap-2 md:hidden">
        <button 
          onClick={onAttachClick}
          className={`p-2.5 rounded-2xl transition-all shadow-sm ${
            hasAttachment 
              ? 'bg-stone-200 text-stone-800' 
              : 'text-stone-400 hover:bg-stone-200 hover:scale-110 active:scale-95 hover:shadow-md'
          }`}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {onMicClick && (
          <button 
            onClick={onMicClick}
            className={`p-2.5 rounded-2xl transition-all shadow-sm ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                : 'text-stone-400 hover:bg-stone-200 hover:scale-110 active:scale-95 hover:shadow-md'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {onVoiceToggle && (
          <button 
            onClick={onVoiceToggle}
            className={`p-2.5 rounded-2xl transition-all shadow-sm ${
              isVoiceOn 
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' 
                : 'text-stone-400 hover:bg-stone-200 hover:scale-110 active:scale-95 hover:shadow-md'
            }`}
          >
            {isVoiceOn ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
        )}

        <button 
          onClick={onSend}
          disabled={!input.trim() && !hasAttachment}
          className="p-2.5 bg-stone-800 text-white rounded-2xl hover:bg-stone-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-md hover:shadow-lg ml-auto"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop: Paperclip */}
            <button
        onClick={onAttachClick}
        className={`hidden md:block p-2 md:p-2.5 rounded-2xl transition-all ${
          hasAttachment
            ? 'bg-stone-200 text-stone-800'
            : 'text-stone-400 hover:bg-stone-200 hover:scale-110 active:scale-95'
        }`}
            >
        <Paperclip className="w-6 h-6" />
            </button>

      {/* Input field */}
            <input
        className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-stone-800 placeholder:text-stone-400 text-base md:text-xl px-2 md:px-0"
        placeholder={isListening ? "Ik luister..." : (hasAttachment ? "Schrijf er iets bij..." : "Typ je vraag...")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSend()}
        onPaste={(e) => {
          if (!onFiles) return
          const items = Array.from(e.clipboardData?.items || [])
          const imageItems = items.filter((it) => it.kind === 'file' && (it.type || '').startsWith('image/'))
          if (imageItems.length === 0) return
          const files = imageItems.map((it) => it.getAsFile()).filter(Boolean) as File[]
          if (files.length > 0) {
            e.preventDefault()
            onFiles(files)
          }
        }}
        ref={inputRef}
      />
      
      {/* Desktop: Overige icoontjes */}
      <div className="hidden md:flex items-center gap-1">
        {onMicClick && (
          <button 
            onClick={onMicClick}
            className={`p-2 md:p-2.5 rounded-2xl transition-all ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                : 'text-stone-400 hover:bg-stone-200 hover:scale-110 active:scale-95'
            }`}
          >
            <Mic className="w-6 h-6" />
          </button>
        )}

        {onVoiceToggle && (
            <button
            onClick={onVoiceToggle}
            className={`p-2 md:p-2.5 rounded-2xl transition-all ${
              isVoiceOn 
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' 
                : 'text-stone-400 hover:bg-stone-200 hover:scale-110 active:scale-95'
            }`}
          >
            {isVoiceOn ? (
              <Volume2 className="w-6 h-6" />
            ) : (
              <VolumeX className="w-6 h-6" />
            )}
            </button>
        )}

            <button
          onClick={onSend}
          disabled={!input.trim() && !hasAttachment}
          className="p-2 md:p-2.5 bg-stone-800 text-white rounded-2xl hover:bg-stone-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
            >
          <Send className="w-5 h-5" />
            </button>
      </div>
    </div>
  )
}

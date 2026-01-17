'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
        code: ({ children }) => (
          <code className="rounded bg-white/70 border border-stone-200 px-1 py-0.5 text-xs">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="whitespace-pre-wrap text-xs bg-white/70 border border-stone-200 rounded-lg p-3 overflow-x-auto">
            {children}
          </pre>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}



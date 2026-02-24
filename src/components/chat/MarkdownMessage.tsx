'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownMessageProps = {
  content: string;
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="space-y-3 text-sm leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="marker:text-[var(--text-muted)]">{children}</li>,
          h1: ({ children }) => <h1 className="mb-2 text-base font-semibold sm:text-lg">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold sm:text-base">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote
              className="mb-3 rounded-r-xl border-l-2 px-3 py-2 italic last:mb-0"
              style={{
                borderColor: 'rgba(127,178,255,0.45)',
                background: 'rgba(127,178,255,0.06)',
              }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
              style={{ color: 'var(--accent-strong, #F35757)' }}
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className={className}>
                  {children}
                </code>
              );
            }

            return (
              <code
                className="rounded-md px-1.5 py-0.5 text-[12px]"
                style={{
                  background: 'rgba(127,178,255,0.10)',
                  border: '1px solid rgba(127,178,255,0.16)',
                  color: 'var(--text)',
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre
              className="mb-3 overflow-x-auto rounded-2xl border p-3 text-[12px] leading-5 last:mb-0"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
              }}
            >
              {children}
            </pre>
          ),
          hr: () => <hr className="my-3 border-0 border-t" style={{ borderColor: 'var(--border)' }} />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-xl border text-xs sm:text-sm" style={{ borderColor: 'var(--border)' }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ background: 'rgba(127,178,255,0.08)' }}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b px-3 py-2 text-left font-semibold" style={{ borderColor: 'var(--border)' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b px-3 py-2 align-top" style={{ borderColor: 'var(--border)' }}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

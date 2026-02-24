'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { aiSettingsStore } from '@/lib/storage';
import { initGSAP } from '@/lib/gsap';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedPrompts(terms: Term[]) {
  const first = terms[0];
  const second = terms[1];
  return [
    first ? `Teach me ${first.term} like I'm a beginner.` : 'Quiz me on these terms.',
    second ? `Compare ${first?.term ?? 'the first term'} and ${second.term}.` : 'Give me a short quiz with 3 questions.',
    'Make me a practice quiz based on this set.',
  ].filter(Boolean);
}

export function ChatBotGame({ studySet }: GameComponentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      content: `I’m your study tutor for “${studySet.title}”. Ask for explanations, quizzes, examples, or memory tricks.`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const prompts = useMemo(() => seedPrompts(studySet.terms), [studySet.terms]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

    const gsap = initGSAP();
    const items = container.querySelectorAll('[data-chat-message]');
    const latest = items[items.length - 1];
    if (latest) {
      gsap.fromTo(latest, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.2, ease: 'power2.out' });
    }
  }, [messages.length]);

  const submit = async (rawText?: string) => {
    const text = (rawText ?? inputValue).trim();
    if (!text || loading) return;

    const settings = aiSettingsStore.get();
    if (!settings.apiKey.trim()) {
      setError('Add an API key in Settings before using Chat Bot.');
      return;
    }

    setError(null);
    setLoading(true);

    const userMessage: ChatMessage = { id: createId(), role: 'user', content: text };
    const assistantMessage: ChatMessage = { id: createId(), role: 'assistant', content: '' };
    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setInputValue('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setTitle: studySet.title,
          terms: studySet.terms.map((term) => ({ term: term.term, definition: term.definition })),
          messages: nextMessages
            .filter((message) => message.id !== assistantMessage.id)
            .map((message) => ({ role: message.role, content: message.content })),
          settings,
        }),
      });

      if (!response.ok || !response.body) {
        let errorMessage = 'Chat request failed.';
        try {
          const payload = (await response.json()) as { error?: string };
          errorMessage = payload.error || errorMessage;
        } catch {
          // ignore JSON parse errors for non-JSON error bodies
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalText = '';

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
          finalText += decoder.decode(chunk.value, { stream: true });
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: finalText } : message,
            ),
          );
        }
      }

      if (!finalText.trim()) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: 'No response text returned.' }
              : message,
          ),
        );
      }
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : 'Unexpected chat error.');
      setMessages((prev) => prev.filter((message) => message.id !== assistantMessage.id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Chat Bot Tutor</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">Streaming tutor chat grounded in this study set’s terms and definitions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMessages([
                  {
                    id: createId(),
                    role: 'assistant',
                    content: `I’m your study tutor for “${studySet.title}”. Ask for explanations, quizzes, examples, or memory tricks.`,
                  },
                ]);
                setError(null);
              }}
            >
              Reset Chat
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void submit(prompt)}
              disabled={loading}
              className="rounded-full border px-3 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-60"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-[28px] p-0 overflow-hidden">
        <div ref={listRef} className="max-h-[520px] space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.map((message) => (
            <div
              key={message.id}
              data-chat-message
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%]"
                style={{
                  background:
                    message.role === 'user'
                      ? 'linear-gradient(135deg, rgba(243,87,87,0.14) 0%, rgba(242,153,94,0.1) 100%)'
                      : 'var(--surface-elevated)',
                  border: `1px solid ${message.role === 'user' ? 'rgba(243,87,87,0.25)' : 'var(--border)'}`,
                }}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {message.role === 'user' ? 'You' : 'Tutor'}
                </p>
                <p className="whitespace-pre-wrap break-words">{message.content || (loading && message.role === 'assistant' ? '…' : '')}</p>
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 px-1 text-sm text-[var(--text-muted)]">
              <Spinner size="sm" /> Streaming response…
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="rounded-[28px] p-4 sm:p-5">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask for explanations, quizzes, examples, or memory tricks…"
            disabled={loading}
          />
          {error ? (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(243,87,87,0.4)', background: 'rgba(243,87,87,0.08)' }}>
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={loading} disabled={!inputValue.trim()}>
              Send
            </Button>
            <span className="text-xs text-[var(--text-muted)]">Uses your saved provider/model settings.</span>
          </div>
        </form>
      </Card>
    </div>
  );
}

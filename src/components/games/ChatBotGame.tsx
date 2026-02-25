'use client';

import { useEffect, useRef } from 'react';

import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { initGSAP } from '@/lib/gsap';
import { useChatTutor } from '@/lib/chat-tutor';

import type { GameComponentProps } from '@/components/games/types';

export function ChatBotGame({ studySet }: GameComponentProps) {
  const {
    getSession,
    getStarterPrompts,
    setSessionInputValue,
    sendMessage,
    resetConversation,
    attachContext,
    openTutor,
  } = useChatTutor();

  const sessionKey = `study-set:${studySet.id}`;
  const session = getSession(sessionKey);
  const prompts = getStarterPrompts(sessionKey);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    attachContext({
      sessionKey,
      setTitle: studySet.title,
      tutorInstruction: studySet.tutorInstruction,
      terms: studySet.terms,
    });
  }, [attachContext, sessionKey, studySet.title, studySet.tutorInstruction, studySet.terms]);

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
  }, [session.messages.length]);

  const submit = async (rawText?: string) => {
    await sendMessage(rawText, { sessionKey });
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Chat Bot Tutor</h2>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Streaming tutor chat grounded in this study set’s terms and definitions.
            </p>
            {studySet.tutorInstruction ? (
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                Focus: {studySet.tutorInstruction}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                openTutor({
                  sessionKey,
                  setTitle: studySet.title,
                  tutorInstruction: studySet.tutorInstruction,
                  terms: studySet.terms,
                })
              }
            >
              Open Popup Tutor
            </Button>
            <Button type="button" variant="secondary" onClick={() => resetConversation({ sessionKey })}>
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
              disabled={session.loading}
              className="rounded-full border px-3 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-60"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-[28px] p-0">
        <div ref={listRef} className="max-h-[520px] space-y-3 overflow-y-auto p-4 sm:p-5">
          {session.messages.map((message) => (
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
                {message.content || (session.loading && message.role === 'assistant') ? (
                  <MarkdownMessage content={message.content || '…'} />
                ) : null}
              </div>
            </div>
          ))}
          {session.loading ? (
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
            value={session.inputValue}
            onChange={(event) => setSessionInputValue(event.target.value, sessionKey)}
            placeholder="Ask for explanations, quizzes, examples, or memory tricks…"
            disabled={session.loading}
          />
          {session.error ? (
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(243,87,87,0.4)', background: 'rgba(243,87,87,0.08)' }}>
              {session.error}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={session.loading} disabled={!session.inputValue.trim()}>
              Send
            </Button>
            <span className="text-xs text-[var(--text-muted)]">Synced with the global AI Tutor popup for this deck.</span>
          </div>
        </form>
      </Card>
    </div>
  );
}

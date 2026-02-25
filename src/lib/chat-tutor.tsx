'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { MarkdownMessage } from '@/components/chat/MarkdownMessage';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { TextArea } from '@/components/ui/TextArea';
import { initGSAP } from '@/lib/gsap';
import { aiSettingsStore } from '@/lib/storage';
import type { Term } from '@/types/study-set';

const DEFAULT_TUTOR_SESSION_KEY = 'global';

type TutorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type TutorContextData = {
  setTitle?: string;
  tutorInstruction?: string;
  terms: Array<Pick<Term, 'term' | 'definition'>>;
};

type TutorSessionState = {
  messages: TutorMessage[];
  inputValue: string;
  loading: boolean;
  error: string | null;
  contextData: TutorContextData;
};

type OpenTutorOptions = {
  sessionKey?: string;
  setTitle?: string;
  tutorInstruction?: string;
  terms?: Array<Pick<Term, 'term' | 'definition'>>;
  initialMessage?: string;
  autoSend?: boolean;
  resetConversation?: boolean;
};

type SendTutorOptions = {
  sessionKey?: string;
  contextOverride?: TutorContextData;
  resetConversation?: boolean;
};

type ResetTutorOptions = {
  sessionKey?: string;
  contextOverride?: TutorContextData;
};

type AttachTutorContextOptions = {
  sessionKey?: string;
  setTitle?: string;
  tutorInstruction?: string;
  terms?: Array<Pick<Term, 'term' | 'definition'>>;
  resetConversation?: boolean;
};

type ChatTutorContextValue = {
  isOpen: boolean;
  activeSessionKey: string;
  openTutor: (options?: OpenTutorOptions) => void;
  closeTutor: () => void;
  getSession: (sessionKey?: string) => TutorSessionState;
  getStarterPrompts: (sessionKey?: string) => string[];
  setSessionInputValue: (value: string, sessionKey?: string) => void;
  sendMessage: (rawText?: string, options?: SendTutorOptions) => Promise<void>;
  resetConversation: (options?: ResetTutorOptions) => void;
  attachContext: (options: AttachTutorContextOptions) => void;
};

const ChatTutorContext = createContext<ChatTutorContextValue | null>(null);

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSessionKey(value?: string) {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_TUTOR_SESSION_KEY;
}

function normalizeTerms(terms?: Array<Pick<Term, 'term' | 'definition'>>) {
  if (!terms?.length) return [];
  return terms
    .filter((term): term is Pick<Term, 'term' | 'definition'> => Boolean(term?.term && term?.definition))
    .slice(0, 60)
    .map((term) => ({
      term: term.term.trim(),
      definition: term.definition.trim(),
    }))
    .filter((term) => term.term && term.definition);
}

function normalizeTutorInstruction(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 1200) : undefined;
}

function buildTutorContext(options?: Pick<OpenTutorOptions, 'setTitle' | 'terms' | 'tutorInstruction'>): TutorContextData {
  return {
    setTitle: options?.setTitle?.trim() || undefined,
    tutorInstruction: normalizeTutorInstruction(options?.tutorInstruction),
    terms: normalizeTerms(options?.terms),
  };
}

function emptyTutorContext(): TutorContextData {
  return { terms: [] };
}

function buildGreeting(context: TutorContextData) {
  if (context.setTitle && context.terms.length) {
    return context.tutorInstruction
      ? `I’m your study tutor for “${context.setTitle}”. I’ll focus on: ${context.tutorInstruction}`
      : `I’m your study tutor for “${context.setTitle}”. Ask for explanations, examples, mnemonics, or quiz help.`;
  }

  return context.tutorInstruction
    ? `I’m your AI study tutor. I’ll focus on: ${context.tutorInstruction}`
    : 'I’m your AI study tutor. Ask a question, paste a tricky prompt, or use “AI Explain” from a game to get help.';
}

function buildStarterPromptsFromContext(context: TutorContextData) {
  if (context.tutorInstruction && context.terms.length) {
    return [
      `Teach me this set with this focus: ${context.tutorInstruction}`,
      'Quiz me on the parts most relevant to my focus.',
      'What should I study first based on my goal?',
    ];
  }

  if (context.terms.length) {
    const first = context.terms[0];
    const second = context.terms[1];
    return [
      first ? `Teach me ${first.term} simply.` : '',
      second ? `Compare ${first?.term ?? 'two terms'} and ${second.term}.` : '',
      'Quiz me on this study set with 3 questions.',
    ].filter(Boolean);
  }

  return [
    context.tutorInstruction ? `Help me learn this goal: ${context.tutorInstruction}` : 'Help me study more effectively.',
    'Explain this concept in simple terms.',
    'Make a short practice quiz for me.',
  ];
}

function createSessionState(contextData?: TutorContextData): TutorSessionState {
  return {
    messages: [],
    inputValue: '',
    loading: false,
    error: null,
    contextData: contextData ?? emptyTutorContext(),
  };
}

function sameTutorContext(a: TutorContextData, b: TutorContextData) {
  if ((a.setTitle ?? '') !== (b.setTitle ?? '')) return false;
  if ((a.tutorInstruction ?? '') !== (b.tutorInstruction ?? '')) return false;
  if (a.terms.length !== b.terms.length) return false;

  return a.terms.every((term, index) => {
    const other = b.terms[index];
    return other && term.term === other.term && term.definition === other.definition;
  });
}

function ensureGreetingMessage(messages: TutorMessage[], context: TutorContextData) {
  if (messages.length) return messages;
  return [
    {
      id: createId(),
      role: 'assistant' as const,
      content: buildGreeting(context),
    },
  ];
}

export function ChatTutorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionKey, setActiveSessionKey] = useState(DEFAULT_TUTOR_SESSION_KEY);
  const [sessions, setSessions] = useState<Record<string, TutorSessionState>>({});

  const sessionsRef = useRef<Record<string, TutorSessionState>>({});
  const activeSessionKeyRef = useRef(DEFAULT_TUTOR_SESSION_KEY);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const patchSessions = useCallback(
    (updater: (prev: Record<string, TutorSessionState>) => Record<string, TutorSessionState>) => {
      setSessions((prev) => {
        const next = updater(prev);
        sessionsRef.current = next;
        return next;
      });
    },
    [],
  );

  const patchSession = useCallback(
    (
      sessionKey: string,
      updater: (prev: TutorSessionState) => TutorSessionState,
    ) => {
      let nextSession = sessionsRef.current[sessionKey] ?? createSessionState();

      patchSessions((prev) => {
        const current = prev[sessionKey] ?? createSessionState();
        nextSession = updater(current);
        return {
          ...prev,
          [sessionKey]: nextSession,
        };
      });

      return nextSession;
    },
    [patchSessions],
  );

  const getSession = useCallback(
    (sessionKey?: string) => {
      const resolvedKey = normalizeSessionKey(sessionKey ?? activeSessionKeyRef.current);
      return sessions[resolvedKey] ?? createSessionState();
    },
    [sessions],
  );

  const getStarterPrompts = useCallback(
    (sessionKey?: string) => buildStarterPromptsFromContext(getSession(sessionKey).contextData),
    [getSession],
  );

  const setSessionInputValue = useCallback(
    (value: string, sessionKey?: string) => {
      const resolvedKey = normalizeSessionKey(sessionKey ?? activeSessionKeyRef.current);
      patchSession(resolvedKey, (session) => ({
        ...session,
        inputValue: value,
      }));
    },
    [patchSession],
  );

  const attachContext = useCallback(
    (options: AttachTutorContextOptions) => {
      const resolvedKey = normalizeSessionKey(options.sessionKey ?? activeSessionKeyRef.current);
      const contextData = buildTutorContext({
        setTitle: options.setTitle,
        tutorInstruction: options.tutorInstruction,
        terms: options.terms,
      });

      patchSession(resolvedKey, (session) => {
        const shouldSeedGreeting = options.resetConversation || session.messages.length === 0;
        const nextMessages = shouldSeedGreeting
          ? ensureGreetingMessage(options.resetConversation ? [] : session.messages, contextData)
          : session.messages;

        if (
          !options.resetConversation &&
          sameTutorContext(session.contextData, contextData) &&
          nextMessages === session.messages
        ) {
          return session;
        }

        return {
          ...session,
          contextData,
          messages: nextMessages,
          error: options.resetConversation ? null : session.error,
          inputValue: options.resetConversation ? '' : session.inputValue,
          loading: options.resetConversation ? false : session.loading,
        };
      });
    },
    [patchSession],
  );

  const resetConversation = useCallback(
    (options?: ResetTutorOptions) => {
      const resolvedKey = normalizeSessionKey(options?.sessionKey ?? activeSessionKeyRef.current);

      patchSession(resolvedKey, (session) => {
        const contextData = options?.contextOverride ?? session.contextData;
        return {
          ...session,
          messages: ensureGreetingMessage([], contextData),
          inputValue: '',
          error: null,
          loading: false,
          contextData,
        };
      });
    },
    [patchSession],
  );

  const sendMessage = useCallback(
    async (rawText?: string, options?: SendTutorOptions) => {
      const resolvedKey = normalizeSessionKey(options?.sessionKey ?? activeSessionKeyRef.current);
      const currentSession = sessionsRef.current[resolvedKey] ?? createSessionState();
      const text = (rawText ?? currentSession.inputValue).trim();
      if (!text || currentSession.loading) return;

      const settings = aiSettingsStore.get();
      if (!settings.apiKey.trim()) {
        activeSessionKeyRef.current = resolvedKey;
        setActiveSessionKey(resolvedKey);
        patchSession(resolvedKey, (session) => ({
          ...session,
          error: 'Add an API key in Settings before using the tutor.',
        }));
        setIsOpen(true);
        return;
      }

      const targetContext = options?.contextOverride ?? currentSession.contextData;
      const baseMessages = ensureGreetingMessage(
        options?.resetConversation ? [] : currentSession.messages,
        targetContext,
      );
      const userMessage: TutorMessage = { id: createId(), role: 'user', content: text };
      const assistantMessage: TutorMessage = { id: createId(), role: 'assistant', content: '' };
      const nextMessages = [...baseMessages, userMessage, assistantMessage];

      patchSession(resolvedKey, (session) => ({
        ...session,
        contextData: targetContext,
        messages: nextMessages,
        inputValue: '',
        error: null,
        loading: true,
      }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setTitle: targetContext.setTitle,
            tutorInstruction: targetContext.tutorInstruction,
            terms: targetContext.terms,
            messages: nextMessages
              .filter((message) => message.id !== assistantMessage.id)
              .map((message) => ({ role: message.role, content: message.content })),
            settings,
          }),
        });

        if (!response.ok || !response.body) {
          let errorMessage = 'Tutor chat request failed.';
          try {
            const payload = (await response.json()) as { error?: string };
            errorMessage = payload.error || errorMessage;
          } catch {
            // ignore non-JSON error bodies
          }
          throw new Error(errorMessage);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalText = '';
        let done = false;

        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          if (!chunk.value) continue;

          finalText += decoder.decode(chunk.value, { stream: true });
          patchSession(resolvedKey, (session) => ({
            ...session,
            messages: session.messages.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: finalText } : message,
            ),
          }));
        }

        if (!finalText.trim()) {
          patchSession(resolvedKey, (session) => ({
            ...session,
            messages: session.messages.map((message) =>
              message.id === assistantMessage.id
                ? { ...message, content: 'No response text returned.' }
                : message,
            ),
          }));
        }
      } catch (chatError) {
        patchSession(resolvedKey, (session) => ({
          ...session,
          error: chatError instanceof Error ? chatError.message : 'Unexpected chat error.',
          messages: session.messages.filter((message) => message.id !== assistantMessage.id),
        }));
      } finally {
        patchSession(resolvedKey, (session) => ({
          ...session,
          loading: false,
        }));
      }
    },
    [patchSession],
  );

  const closeTutor = useCallback(() => setIsOpen(false), []);

  const openTutor = useCallback(
    (options?: OpenTutorOptions) => {
      const resolvedKey = normalizeSessionKey(options?.sessionKey ?? activeSessionKeyRef.current);
      activeSessionKeyRef.current = resolvedKey;
      setActiveSessionKey(resolvedKey);
      setIsOpen(true);

      if (options?.setTitle || options?.terms || options?.tutorInstruction) {
        attachContext({
          sessionKey: resolvedKey,
          setTitle: options.setTitle,
          tutorInstruction: options.tutorInstruction,
          terms: options.terms,
          resetConversation: options.resetConversation,
        });
      } else if (options?.resetConversation) {
        resetConversation({ sessionKey: resolvedKey });
      } else {
        patchSession(resolvedKey, (session) => ({
          ...session,
          messages: ensureGreetingMessage(session.messages, session.contextData),
        }));
      }

      if (options?.initialMessage?.trim()) {
        if (options.autoSend) {
          window.setTimeout(() => {
            void sendMessage(options.initialMessage, {
              sessionKey: resolvedKey,
              contextOverride:
                options.setTitle || options.terms || options.tutorInstruction
                  ? buildTutorContext({
                      setTitle: options.setTitle,
                      tutorInstruction: options.tutorInstruction,
                      terms: options.terms,
                    })
                  : undefined,
              resetConversation: false,
            });
          }, 0);
        } else {
          setSessionInputValue(options.initialMessage, resolvedKey);
        }
      }
    },
    [attachContext, patchSession, resetConversation, sendMessage, setSessionInputValue],
  );

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTutor();
    };

    document.addEventListener('keydown', onKeyDown);

    const gsap = initGSAP();
    if (overlayRef.current) {
      gsap.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power2.out' });
    }
    if (panelRef.current) {
      gsap.fromTo(panelRef.current, { y: 24, autoAlpha: 0, scale: 0.98 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.24, ease: 'power2.out' });
    }

    window.setTimeout(() => textareaRef.current?.focus(), 80);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closeTutor]);

  const activeSession = getSession(activeSessionKey);
  const activeStarterPrompts = getStarterPrompts(activeSessionKey);

  useEffect(() => {
    const container = listRef.current;
    if (!container || !activeSession.messages.length) return;

    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

    const gsap = initGSAP();
    const items = container.querySelectorAll('[data-tutor-message]');
    const latest = items[items.length - 1];
    if (latest) {
      gsap.fromTo(latest, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.18, ease: 'power2.out' });
    }
  }, [activeSessionKey, activeSession.messages.length]);

  const contextValue: ChatTutorContextValue = {
    isOpen,
    activeSessionKey,
    openTutor,
    closeTutor,
    getSession,
    getStarterPrompts,
    setSessionInputValue,
    sendMessage,
    resetConversation,
    attachContext,
  };

  return (
    <ChatTutorContext.Provider value={contextValue}>
      {children}

      <button
        type="button"
        onClick={() => openTutor()}
        className="fixed bottom-5 right-5 z-[70] rounded-full border px-4 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5"
        style={{
          borderColor: 'rgba(243,87,87,0.28)',
          background: 'linear-gradient(135deg, rgba(243,87,87,0.18) 0%, rgba(127,178,255,0.14) 100%)',
          backdropFilter: 'blur(14px)',
        }}
        aria-label="Open AI tutor chat"
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>✨</span>
          <span>AI Tutor</span>
        </span>
      </button>

      {isOpen ? (
        <div ref={overlayRef} className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={closeTutor}
            aria-label="Close AI tutor"
          />

          <div className="absolute inset-x-0 bottom-0 top-8 flex items-end justify-end p-3 sm:inset-y-0 sm:top-0 sm:p-5">
            <div
              ref={panelRef}
              className="relative flex h-[min(88vh,760px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[28px] border"
              style={{
                borderColor: 'var(--border)',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--surface) 88%, transparent) 0%, color-mix(in srgb, var(--surface-elevated) 92%, transparent) 100%)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.34)',
                backdropFilter: 'blur(18px)',
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="chat-tutor-title"
            >
              <div
                className="absolute inset-x-6 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(243,87,87,0.4), rgba(127,178,255,0.35), transparent)' }}
                aria-hidden
              />

              <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Study Arcade</p>
                    <h2 id="chat-tutor-title" className="mt-1 text-lg font-semibold sm:text-xl">AI Tutor</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => resetConversation({ sessionKey: activeSessionKey })}>
                      Reset
                    </Button>
                    <button
                      type="button"
                      onClick={closeTutor}
                      className="grid h-9 w-9 place-items-center rounded-full border text-lg leading-none transition hover:opacity-90"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                      aria-label="Close tutor"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeSession.contextData.setTitle ? (
                    <span
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: 'rgba(127,178,255,0.35)', background: 'rgba(127,178,255,0.08)' }}
                    >
                      Set: {activeSession.contextData.setTitle}
                    </span>
                  ) : null}
                  <span
                    className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    {activeSession.contextData.terms.length ? `${activeSession.contextData.terms.length} terms loaded` : 'General tutor mode'}
                  </span>
                  {activeSession.contextData.tutorInstruction ? (
                    <span
                      className="inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: 'rgba(243,87,87,0.28)', background: 'rgba(243,87,87,0.07)' }}
                      title={activeSession.contextData.tutorInstruction}
                    >
                      Focus: {activeSession.contextData.tutorInstruction.length > 72
                        ? `${activeSession.contextData.tutorInstruction.slice(0, 72)}…`
                        : activeSession.contextData.tutorInstruction}
                    </span>
                  ) : null}
                  <span className="text-xs text-[var(--text-muted)]">Uses your saved provider settings</span>
                </div>
              </div>

              {activeSession.messages.length <= 1 ? (
                <div className="border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap gap-2">
                    {activeStarterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt, { sessionKey: activeSessionKey })}
                        disabled={activeSession.loading}
                        className="rounded-full border px-3 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-60"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                {activeSession.messages.map((message) => (
                  <div
                    key={message.id}
                    data-tutor-message
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[86%]"
                      style={{
                        background:
                          message.role === 'user'
                            ? 'linear-gradient(135deg, rgba(243,87,87,0.14) 0%, rgba(242,153,94,0.1) 100%)'
                            : 'var(--surface-elevated)',
                        border: `1px solid ${message.role === 'user' ? 'rgba(243,87,87,0.24)' : 'var(--border)'}`,
                      }}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {message.role === 'user' ? 'You' : 'Tutor'}
                      </p>
                      {message.content || (activeSession.loading && message.role === 'assistant') ? (
                        <MarkdownMessage content={message.content || '…'} />
                      ) : null}
                    </div>
                  </div>
                ))}

                {activeSession.loading ? (
                  <div className="flex items-center gap-2 px-1 text-sm text-[var(--text-muted)]">
                    <Spinner size="sm" /> Thinking…
                  </div>
                ) : null}
              </div>

              <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: 'var(--border)' }}>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage(undefined, { sessionKey: activeSessionKey });
                  }}
                >
                  <TextArea
                    ref={textareaRef}
                    value={activeSession.inputValue}
                    onChange={(event) => setSessionInputValue(event.target.value, activeSessionKey)}
                    placeholder="Ask for an explanation, examples, or study help…"
                    rows={3}
                    disabled={activeSession.loading}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        void sendMessage(undefined, { sessionKey: activeSessionKey });
                      }
                    }}
                  />

                  {activeSession.error ? (
                    <div
                      className="rounded-2xl border px-4 py-3 text-sm"
                      style={{ borderColor: 'rgba(243,87,87,0.4)', background: 'rgba(243,87,87,0.08)' }}
                    >
                      {activeSession.error}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-muted)]">Press Cmd/Ctrl + Enter to send</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="secondary" onClick={closeTutor}>
                        Close
                      </Button>
                      <Button type="submit" loading={activeSession.loading} disabled={!activeSession.inputValue.trim()}>
                        Send
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ChatTutorContext.Provider>
  );
}

export function useChatTutor() {
  const context = useContext(ChatTutorContext);
  if (!context) {
    throw new Error('useChatTutor must be used inside ChatTutorProvider');
  }

  return context;
}

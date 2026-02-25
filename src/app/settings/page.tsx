'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { aiSettingsStore } from '@/lib/storage';
import { getDefaultModelForProvider } from '@/lib/ai/providers';
import type { AIProvider } from '@/types/settings';
import { DEFAULT_AI_SETTINGS, STUDY_LIMITS, type AISettings } from '@/types/settings';

const providerDescriptions: Record<AIProvider, string> = {
  openai: 'Best general-purpose choice for fast MVP generation and quiz content.',
  anthropic: 'Great for longer context and careful term extraction from dense notes.',
  google: 'Fast and cost-effective option for quick game data generation.',
};

export default function SettingsPage() {
  const [form, setForm] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(aiSettingsStore.get());
  }, []);

  const helperText = useMemo(() => providerDescriptions[form.provider], [form.provider]);

  const update = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateNumber = (key: 'maxTermsPerDeck' | 'maxCardsPerGame', rawValue: string) => {
    const next = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(next)) return;
    update(key, next);
  };

  const onProviderChange = (provider: AIProvider) => {
    setSaved(false);
    setForm((prev) => ({
      ...prev,
      provider,
      model:
        prev.model.trim() && prev.model !== getDefaultModelForProvider(prev.provider)
          ? prev.model
          : getDefaultModelForProvider(provider),
    }));
  };

  const saveSettings = () => {
    aiSettingsStore.set(form);
    setForm(aiSettingsStore.get());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-2">
        <p
          className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
          style={{ borderColor: 'var(--border)' }}
        >
          AI Provider Settings
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Local-only model config</h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          API keys are stored in your browser localStorage for this MVP and sent to local API routes when you
          generate terms or game data.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">Provider</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['openai', 'anthropic', 'google'] as AIProvider[]).map((provider) => {
                  const active = form.provider === provider;
                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => onProviderChange(provider)}
                      className="rounded-2xl border px-3 py-3 text-left text-sm font-semibold capitalize transition"
                      style={{
                        borderColor: active ? 'rgba(243, 87, 87, 0.6)' : 'var(--border)',
                        background: active ? 'rgba(243, 87, 87, 0.08)' : 'var(--surface)',
                      }}
                    >
                      {provider}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{helperText}</p>
            </div>

            <div>
              <label htmlFor="model" className="mb-2 block text-sm font-semibold">
                Model
              </label>
              <Input
                id="model"
                value={form.model}
                onChange={(event) => update('model', event.target.value)}
                placeholder="gpt-4o-mini"
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Suggested defaults: `gpt-4o-mini`, `claude-sonnet-4-5-20250929`, `gemini-1.5-flash`
              </p>
            </div>

            <div>
              <label htmlFor="apiKey" className="mb-2 block text-sm font-semibold">
                API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                value={form.apiKey}
                onChange={(event) => update('apiKey', event.target.value)}
                placeholder="Paste your provider API key"
              />
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                MVP tradeoff: keys are stored client-side only. Do not use production credentials here.
              </p>
            </div>

            <div
              className="rounded-2xl border p-4 sm:p-5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Study Limits</h3>
                <p className="text-xs leading-5 text-[var(--text-muted)]">
                  Global caps for deck size and game item/card counts. Existing cached game data may need a reset/regeneration to reflect changes.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="maxTermsPerDeck" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Max Terms Per Deck
                  </label>
                  <Input
                    id="maxTermsPerDeck"
                    type="number"
                    inputMode="numeric"
                    min={STUDY_LIMITS.maxTermsPerDeck.min}
                    max={STUDY_LIMITS.maxTermsPerDeck.max}
                    value={form.maxTermsPerDeck}
                    onChange={(event) => updateNumber('maxTermsPerDeck', event.target.value)}
                  />
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Range: {STUDY_LIMITS.maxTermsPerDeck.min}-{STUDY_LIMITS.maxTermsPerDeck.max}
                  </p>
                </div>

                <div>
                  <label htmlFor="maxCardsPerGame" className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Max Cards/Items Per Game
                  </label>
                  <Input
                    id="maxCardsPerGame"
                    type="number"
                    inputMode="numeric"
                    min={STUDY_LIMITS.maxCardsPerGame.min}
                    max={STUDY_LIMITS.maxCardsPerGame.max}
                    value={form.maxCardsPerGame}
                    onChange={(event) => updateNumber('maxCardsPerGame', event.target.value)}
                  />
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Range: {STUDY_LIMITS.maxCardsPerGame.min}-{STUDY_LIMITS.maxCardsPerGame.max}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={saveSettings}>Save Settings</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm(DEFAULT_AI_SETTINGS);
                  setSaved(false);
                }}
              >
                Reset Defaults
              </Button>
              {saved ? <span className="text-sm font-semibold text-olive">Saved</span> : null}
            </div>
          </div>
        </Card>

        <Card className="grid-bg overflow-hidden rounded-[28px] border-0 bg-[var(--surface-elevated)] p-5 sm:p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Provider presets</h2>
            <div className="space-y-3">
              {([
                ['OpenAI', 'gpt-4o-mini', '#F35757', 'Fast default for term extraction + game JSON'],
                ['Anthropic', 'claude-sonnet-4-5-20250929', '#AFA3FF', 'Strong reasoning and concise explanations'],
                ['Google', 'gemini-1.5-flash', '#7FB2FF', 'Quick response time and low-latency generation'],
              ] as const).map(([name, model, color, detail], index) => (
                <div
                  key={name}
                  className="rounded-3xl p-4 text-sm shadow-card"
                  style={{
                    background: color,
                    color: '#111',
                    transform: `rotate(${index % 2 === 0 ? -1.8 : 1.4}deg)`,
                  }}
                >
                  <p className="font-semibold">{name}</p>
                  <p className="mt-1 text-xs font-medium">{model}</p>
                  <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed p-4 text-xs leading-5 text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
              The app falls back to local deterministic generation if the API call fails, so you can still test flows while wiring credentials.
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

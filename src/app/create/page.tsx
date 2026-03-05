'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { TermEditor } from '@/components/create/TermEditor';
import { TextInput } from '@/components/create/TextInput';
import { TopicInput } from '@/components/create/TopicInput';
import { UploadZone } from '@/components/create/UploadZone';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { getAnalyticsRequestHeaders } from '@/lib/analytics/session';
import { extractTextFromPdf } from '@/lib/pdf';
import { aiSettingsStore, studySetStore } from '@/lib/storage';
import { DEFAULT_AI_SETTINGS } from '@/types/settings';
import type { SourceType, StudySet, Term } from '@/types/study-set';

const SOURCE_MODES: Array<{ key: SourceType; label: string; blurb: string }> = [
  { key: 'text', label: 'Text', blurb: 'Paste notes or reading excerpts' },
  { key: 'document', label: 'PDF', blurb: 'Upload a PDF and extract text locally' },
  { key: 'topic', label: 'Topic', blurb: 'Generate terms from a subject prompt' },
];

interface GenerateTermsResponse {
  title?: string;
  description?: string;
  terms?: Array<{ term: string; definition: string }>;
  warning?: string;
  source?: 'llm' | 'fallback';
  error?: unknown;
}

function CreatePageContent() {
  const { trackEvent } = useAnalytics();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const regenIntent = searchParams.get('regen') === '1';
  const [mode, setMode] = useState<SourceType>('text');
  const [textSource, setTextSource] = useState('');
  const [topicSource, setTopicSource] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [documentFileName, setDocumentFileName] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tutorInstruction, setTutorInstruction] = useState('');
  const [terms, setTerms] = useState<Term[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editSourceSet, setEditSourceSet] = useState<StudySet | null>(null);
  const [editLookupState, setEditLookupState] = useState<'idle' | 'loading' | 'ready' | 'not-found'>('idle');
  const [configuredLimits, setConfiguredLimits] = useState(() => ({
    maxTermsPerDeck: DEFAULT_AI_SETTINGS.maxTermsPerDeck,
    maxCardsPerGame: DEFAULT_AI_SETTINGS.maxCardsPerGame,
  }));

  useEffect(() => {
    const settings = aiSettingsStore.get();
    setConfiguredLimits({
      maxTermsPerDeck: settings.maxTermsPerDeck,
      maxCardsPerGame: settings.maxCardsPerGame,
    });
  }, []);

  useEffect(() => {
    if (!editId) {
      setEditSourceSet(null);
      setEditLookupState('idle');
      return;
    }

    setEditLookupState('loading');
    const existing = studySetStore.get(editId);

    if (!existing) {
      setEditSourceSet(null);
      setEditLookupState('not-found');
      setError('Study set not found for editing. It may have been deleted from localStorage.');
      setStatus(null);
      return;
    }

    setEditSourceSet(existing);
    setEditLookupState('ready');
    setMode(existing.sourceType);
    setTextSource(existing.sourceType === 'text' ? existing.sourceContent : '');
    setTopicSource(existing.sourceType === 'topic' ? existing.sourceContent : '');
    setDocumentText(existing.sourceType === 'document' ? existing.sourceContent : '');
    setDocumentFileName(existing.sourceType === 'document' ? 'Saved PDF source text' : '');
    setTitle(existing.title);
    setDescription(existing.description ?? '');
    setTutorInstruction(existing.tutorInstruction ?? '');
    setTerms(existing.terms.map((term) => ({ ...term })));
    setError(null);
    setStatus(
      regenIntent
        ? `Opened “${existing.title}” in re-generate mode. Review the saved source and click Re-generate Terms to replace the current term list.`
        : `Loaded “${existing.title}” for editing.`,
    );
  }, [editId, regenIntent]);

  const activeSourceContent = useMemo(() => {
    if (mode === 'text') return textSource;
    if (mode === 'topic') return topicSource;
    return documentText;
  }, [mode, textSource, topicSource, documentText]);

  const canGenerate = useMemo(() => activeSourceContent.trim().length > 0, [activeSourceContent]);
  const isEditing = Boolean(editId && editSourceSet);
  const showEditNotFound = Boolean(editId) && editLookupState === 'not-found';

  const restoreSavedTerms = () => {
    if (!editSourceSet) return;
    setTerms(editSourceSet.terms.map((term) => ({ ...term })));
    setStatus(`Restored ${editSourceSet.terms.length} saved term${editSourceSet.terms.length === 1 ? '' : 's'} from this deck.`);
    setError(null);
  };

  const handlePdfFile = async (file: File) => {
    setDocumentLoading(true);
    setError(null);
    setStatus(null);
    trackEvent('pdf_extract_start', {
      mode: 'create',
      source_type: 'document',
      file_size_bucket:
        file.size < 300_000
          ? 'lt_300kb'
          : file.size < 1_000_000
            ? '300kb_1mb'
            : file.size < 5_000_000
              ? '1mb_5mb'
              : 'gte_5mb',
    });
    try {
      const extracted = await extractTextFromPdf(file);
      setDocumentText(extracted);
      setDocumentFileName(file.name);
      setStatus(`Extracted ${Math.max(1, Math.round(extracted.length / 5))} words from ${file.name}`);
      trackEvent('pdf_extract_result', { result: 'success', source_type: 'document' });
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : 'Failed to extract PDF text.');
      trackEvent('pdf_extract_result', { result: 'error', source_type: 'document' });
    } finally {
      setDocumentLoading(false);
    }
  };

  const generateTerms = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);
    setStatus(null);
    trackEvent('terms_generate_start', { source_type: mode, mode: isEditing ? 'edit' : 'create' });

    const settings = aiSettingsStore.get();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAnalyticsRequestHeaders(),
        },
        body: JSON.stringify({
          mode: 'extract-terms',
          inputText: mode === 'text' || mode === 'document' ? activeSourceContent : undefined,
          topic: mode === 'topic' ? topicSource : undefined,
          tutorInstruction: tutorInstruction.trim() || undefined,
          settings,
        }),
      });

      const result = (await response.json()) as GenerateTermsResponse;

      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Failed to generate terms. Check provider settings or try again.',
        );
      }

      const mappedTerms = (result.terms ?? [])
        .filter((term) => term.term?.trim() && term.definition?.trim())
        .map((term) => ({
          id: uuidv4(),
          term: term.term.trim(),
          definition: term.definition.trim(),
        }));
      const cappedTerms = mappedTerms.slice(0, settings.maxTermsPerDeck);
      const trimmedCount = Math.max(0, mappedTerms.length - cappedTerms.length);

      setTerms(cappedTerms);
      setTitle(result.title?.trim() || (mode === 'topic' ? topicSource.trim() : 'New Study Set'));
      setDescription(result.description?.trim() || `Generated from ${mode === 'document' ? documentFileName || 'PDF upload' : mode} input.`);
      setStatus(
        `${result.source === 'fallback' ? 'Fallback generation used.' : 'Terms generated.'} ${cappedTerms.length} term${cappedTerms.length === 1 ? '' : 's'} ready for review.${trimmedCount ? ` Trimmed ${trimmedCount} to respect your Settings deck limit (${settings.maxTermsPerDeck}).` : ''}${isEditing ? ' Saving will replace the deck terms and reset cached game data.' : ''}${result.warning ? ` ${result.warning}` : ''}`,
      );
      trackEvent('terms_generate_result', {
        source_type: mode,
        result: result.source === 'fallback' ? 'fallback' : 'success',
        terms_count: cappedTerms.length,
        has_warning: Boolean(result.warning),
      });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unexpected generation error.');
      trackEvent('terms_generate_result', {
        source_type: mode,
        result: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveStudySet = () => {
    if (!terms.length) {
      setError('Generate and review terms before saving.');
      return;
    }

    const cleanedTerms = terms
      .map((term) => ({ ...term, term: term.term.trim(), definition: term.definition.trim() }))
      .filter((term) => term.term && term.definition);

    if (!cleanedTerms.length) {
      setError('At least one valid term/definition pair is required.');
      return;
    }

    const currentSettings = aiSettingsStore.get();
    if (cleanedTerms.length > currentSettings.maxTermsPerDeck) {
      setError(
        `This deck has ${cleanedTerms.length} terms, but your Settings cap is ${currentSettings.maxTermsPerDeck}. Remove some terms or increase the deck limit in Settings.`,
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    const now = Date.now();
    const nextTitle = title.trim() || (mode === 'topic' ? topicSource.trim() : 'Untitled Study Set');
    const nextDescription = description.trim();
    const nextTutorInstruction = tutorInstruction.trim() || undefined;

    if (editSourceSet) {
      const normalizedCurrentTerms = cleanedTerms.map((term) => `${term.term}::${term.definition}`);
      const normalizedOriginalTerms = editSourceSet.terms
        .map((term) => ({ ...term, term: term.term.trim(), definition: term.definition.trim() }))
        .filter((term) => term.term && term.definition)
        .map((term) => `${term.term}::${term.definition}`);

      const termsChanged = JSON.stringify(normalizedCurrentTerms) !== JSON.stringify(normalizedOriginalTerms);
      const sourceChanged = editSourceSet.sourceType !== mode || editSourceSet.sourceContent !== activeSourceContent;
      const cacheShouldReset = termsChanged || sourceChanged;

      const updatedSet: StudySet = {
        ...editSourceSet,
        title: nextTitle,
        description: nextDescription,
        tutorInstruction: nextTutorInstruction,
        sourceType: mode,
        sourceContent: activeSourceContent,
        terms: cleanedTerms,
        updatedAt: now,
        gameData: cacheShouldReset ? {} : editSourceSet.gameData,
      };

      studySetStore.upsert(updatedSet);
      trackEvent('set_save', {
        mode: 'update',
        source_type: mode,
        set_id: editSourceSet.id,
        terms_count: cleanedTerms.length,
        result: 'success',
      });
      router.push(`/set/${editSourceSet.id}`);
      return;
    }

    const id = uuidv4();
    const studySet: StudySet = {
      id,
      title: nextTitle,
      description: nextDescription,
      tutorInstruction: nextTutorInstruction,
      sourceType: mode,
      sourceContent: activeSourceContent,
      terms: cleanedTerms,
      createdAt: now,
      updatedAt: now,
      gameData: {},
    };

    studySetStore.upsert(studySet);
    trackEvent('set_save', {
      mode: 'create',
      source_type: mode,
      set_id: id,
      terms_count: cleanedTerms.length,
      result: 'success',
    });
    router.push(`/set/${id}`);
  };

  if (Boolean(editId) && editLookupState === 'loading') {
    return (
      <section className="mx-auto max-w-6xl space-y-5">
        <Card className="rounded-[28px] p-6">
          <p className="text-sm text-[var(--text-muted)]">Loading study set for editing…</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2">
        <p className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
          {isEditing ? 'Edit Study Set' : 'Create Study Set'}
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
          {isEditing ? 'Refine source, terms, and tutor focus.' : 'Feed content in, get game-ready terms out.'}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          {isEditing
            ? 'Update deck metadata, tweak terms, or re-generate from the saved source. Changing terms/source resets cached game data for this deck.'
            : 'Use text paste, PDF upload, or a topic prompt. Term extraction calls the configured LLM and falls back to local extraction when unavailable.'}
        </p>
      </div>

      {showEditNotFound ? (
        <Card className="rounded-[24px] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--text-muted)]">This study set no longer exists locally.</p>
            <Button type="button" variant="secondary" onClick={() => router.push('/')}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {SOURCE_MODES.map((sourceMode) => {
                const active = sourceMode.key === mode;
                return (
                  <button
                    key={sourceMode.key}
                    type="button"
                    onClick={() => {
                      trackEvent('source_mode_change', { source_type: sourceMode.key });
                      setMode(sourceMode.key);
                      setError(null);
                      setStatus(null);
                    }}
                    className="rounded-2xl border p-3 text-left transition"
                    style={{
                      borderColor: active ? 'rgba(243, 87, 87, 0.5)' : 'var(--border)',
                      background: active ? 'rgba(243, 87, 87, 0.06)' : 'var(--surface)',
                    }}
                  >
                    <p className="text-sm font-semibold">{sourceMode.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{sourceMode.blurb}</p>
                  </button>
                );
              })}
            </div>

            {mode === 'text' ? <TextInput value={textSource} onChange={setTextSource} /> : null}
            {mode === 'topic' ? <TopicInput value={topicSource} onChange={setTopicSource} /> : null}
            {mode === 'document' ? (
              <div className="space-y-3">
                <UploadZone
                  onFileSelected={handlePdfFile}
                  loading={documentLoading}
                  fileName={documentFileName}
                  helperText={documentText ? `${documentText.length.toLocaleString()} characters extracted` : undefined}
                />
                {documentText ? (
                  <TextArea
                    value={documentText}
                    onChange={(event) => setDocumentText(event.target.value)}
                    className="min-h-[180px]"
                    placeholder="Extracted PDF text appears here"
                  />
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" onClick={generateTerms} loading={isGenerating} disabled={!canGenerate || documentLoading || showEditNotFound}>
                {isEditing ? 'Re-generate Terms' : 'Generate Terms'}
              </Button>
              {isEditing ? (
                <Button type="button" variant="ghost" onClick={restoreSavedTerms} disabled={!editSourceSet || isGenerating}>
                  Reset to Saved Terms
                </Button>
              ) : null}
              <span className="text-xs leading-5 text-[var(--text-muted)]">
                {isEditing ? 'Re-generation replaces the current editable term list.' : 'Uses your provider settings from the Settings page.'}
              </span>
            </div>

            {status ? (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(166, 190, 89, 0.45)', background: 'rgba(166, 190, 89, 0.08)' }}>
                {status}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(243, 87, 87, 0.45)', background: 'rgba(243, 87, 87, 0.08)' }}>
                {error}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="grid-bg rounded-[28px] border-0 bg-[var(--surface-elevated)] p-5 sm:p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Study set details</h2>
            <div className="grid gap-3">
              <div>
                <label htmlFor="set-title" className="mb-2 block text-sm font-semibold">
                  Title
                </label>
                <Input
                  id="set-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Generated title appears here"
                />
              </div>
              <div>
                <label htmlFor="set-description" className="mb-2 block text-sm font-semibold">
                  Description
                </label>
                <TextArea
                  id="set-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Short summary for the dashboard card"
                  className="min-h-[120px]"
                />
              </div>
              <div>
                <label htmlFor="tutor-instruction" className="mb-2 block text-sm font-semibold">
                  Tutor Focus (Optional)
                </label>
                <TextArea
                  id="tutor-instruction"
                  value={tutorInstruction}
                  onChange={(event) => setTutorInstruction(event.target.value)}
                  placeholder="What exactly do you want to learn from this source? Example: Focus on understanding evaluation metrics and when to use each one."
                  className="min-h-[120px]"
                />
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  Used to focus term extraction and guide the AI Tutor for this deck.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: 'var(--border)' }}>
              <p className="font-semibold">Current source mode</p>
              <p className="mt-1 text-[var(--text-muted)]">
                {mode === 'text' && 'Plain text paste'}
                {mode === 'document' && 'PDF upload (editable extracted text)'}
                {mode === 'topic' && 'Topic prompt'}
              </p>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Saving stores source text, term list, and future game data caches in browser localStorage.
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Current caps from Settings: {configuredLimits.maxTermsPerDeck} terms per deck, {configuredLimits.maxCardsPerGame} cards/items per game.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {terms.length ? <TermEditor terms={terms} onChange={setTerms} /> : null}

      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">{isEditing ? 'Update deck and return to games' : 'Save and open game selector'}</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {isEditing
                ? 'Updates are stored locally. If terms/source changed, cached game data is reset and rebuilt on next play.'
                : 'The set is stored locally and the game grid will generate/caches data on first play.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  trackEvent('set_cancel', { mode: 'edit', source_type: mode, set_id: editSourceSet?.id });
                  router.push(editSourceSet ? `/set/${editSourceSet.id}` : '/');
                }}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              onClick={saveStudySet}
              loading={isSaving}
              disabled={!terms.length || showEditNotFound}
            >
              {isEditing ? 'Update Study Set' : 'Save Study Set'}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={(
        <section className="mx-auto max-w-6xl space-y-5">
          <Card className="rounded-[28px] p-6">
            <p className="text-sm text-[var(--text-muted)]">Loading create flow…</p>
          </Card>
        </section>
      )}
    >
      <CreatePageContent />
    </Suspense>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { TermEditor } from '@/components/create/TermEditor';
import { TextInput } from '@/components/create/TextInput';
import { TopicInput } from '@/components/create/TopicInput';
import { UploadZone } from '@/components/create/UploadZone';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { extractTextFromPdf } from '@/lib/pdf';
import { aiSettingsStore, studySetStore } from '@/lib/storage';
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

export default function CreatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<SourceType>('text');
  const [textSource, setTextSource] = useState('');
  const [topicSource, setTopicSource] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [documentFileName, setDocumentFileName] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [terms, setTerms] = useState<Term[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSourceContent = useMemo(() => {
    if (mode === 'text') return textSource;
    if (mode === 'topic') return topicSource;
    return documentText;
  }, [mode, textSource, topicSource, documentText]);

  const canGenerate = useMemo(() => activeSourceContent.trim().length > 0, [activeSourceContent]);

  const handlePdfFile = async (file: File) => {
    setDocumentLoading(true);
    setError(null);
    setStatus(null);
    try {
      const extracted = await extractTextFromPdf(file);
      setDocumentText(extracted);
      setDocumentFileName(file.name);
      setStatus(`Extracted ${Math.max(1, Math.round(extracted.length / 5))} words from ${file.name}`);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : 'Failed to extract PDF text.');
    } finally {
      setDocumentLoading(false);
    }
  };

  const generateTerms = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);
    setStatus(null);

    const settings = aiSettingsStore.get();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'extract-terms',
          inputText: mode === 'text' || mode === 'document' ? activeSourceContent : undefined,
          topic: mode === 'topic' ? topicSource : undefined,
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

      setTerms(mappedTerms);
      setTitle(result.title?.trim() || (mode === 'topic' ? topicSource.trim() : 'New Study Set'));
      setDescription(result.description?.trim() || `Generated from ${mode === 'document' ? documentFileName || 'PDF upload' : mode} input.`);
      setStatus(
        `${result.source === 'fallback' ? 'Fallback generation used.' : 'Terms generated.'} ${mappedTerms.length} term${mappedTerms.length === 1 ? '' : 's'} ready for review.${result.warning ? ` ${result.warning}` : ''}`,
      );
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unexpected generation error.');
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

    setIsSaving(true);
    setError(null);

    const now = Date.now();
    const id = uuidv4();
    const studySet: StudySet = {
      id,
      title: title.trim() || (mode === 'topic' ? topicSource.trim() : 'Untitled Study Set'),
      description: description.trim(),
      sourceType: mode,
      sourceContent: activeSourceContent,
      terms: cleanedTerms,
      createdAt: now,
      updatedAt: now,
      gameData: {},
    };

    studySetStore.upsert(studySet);
    router.push(`/set/${id}`);
  };

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-2">
        <p className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" style={{ borderColor: 'var(--border)' }}>
          Create Study Set
        </p>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
          Feed content in, get game-ready terms out.
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          Use text paste, PDF upload, or a topic prompt. Term extraction calls the configured LLM and falls back to local extraction when unavailable.
        </p>
      </div>

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
              <Button type="button" onClick={generateTerms} loading={isGenerating} disabled={!canGenerate || documentLoading}>
                Generate Terms
              </Button>
              <span className="text-xs leading-5 text-[var(--text-muted)]">
                Uses your provider settings from the Settings page.
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
            </div>
          </div>
        </Card>
      </div>

      {terms.length ? <TermEditor terms={terms} onChange={setTerms} /> : null}

      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Save and open game selector</h2>
            <p className="text-sm text-[var(--text-muted)]">
              The set is stored locally and the game grid will generate/caches data on first play.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={saveStudySet}
            loading={isSaving}
            disabled={!terms.length}
          >
            Save Study Set
          </Button>
        </div>
      </Card>
    </section>
  );
}

import { generateObject, generateText } from 'ai';
import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { getAnalyticsHeaders, trackServerApiRequest } from '@/lib/analytics/server';
import { buildGamePrompt, buildTermExtractionPrompt } from '@/lib/ai/prompts';
import { getLanguageModel } from '@/lib/ai/providers';
import {
  gameSchemaByType,
  generateRouteSchema,
  termExtractionSchema,
  type TermExtractionResult,
} from '@/lib/ai/schemas';
import { GameType } from '@/types/game';
import { STUDY_LIMITS } from '@/types/settings';

function dedupeTerms(terms: TermExtractionResult['terms']) {
  const seen = new Set<string>();
  return terms.filter((item) => {
    const key = item.term.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveMaxTermsPerDeck(settings: { maxTermsPerDeck?: number }) {
  const raw = settings.maxTermsPerDeck;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return STUDY_LIMITS.maxTermsPerDeck.default;
  return Math.min(
    STUDY_LIMITS.maxTermsPerDeck.max,
    Math.max(STUDY_LIMITS.maxTermsPerDeck.min, Math.round(raw)),
  );
}

function parseJsonFromModelText(text: string): unknown {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fencedMatch?.[1] ?? text).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Try to recover from extra prose by extracting the first JSON object block.
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('Model response did not contain valid JSON.');
  }
}

function formatZodIssue(error: z.ZodError) {
  const first = error.issues[0];
  if (!first) return 'Generated JSON did not match expected schema.';
  const path = first.path.length ? first.path.join('.') : 'root';
  return `${path}: ${first.message}`;
}

async function generateObjectCompat<T extends z.ZodTypeAny>(input: {
  provider: 'openai' | 'anthropic' | 'google';
  model: ReturnType<typeof getLanguageModel>;
  schema: T;
  system: string;
  prompt: string;
  anthropicJsonShape: string;
}) {
  if (input.provider !== 'anthropic') {
    const result = await generateObject({
      model: input.model,
      schema: input.schema,
      system: input.system,
      prompt: input.prompt,
    });
    return result.object as z.infer<T>;
  }

  const { text } = await generateText({
    model: input.model,
    system: input.system,
    prompt: `${input.prompt}\n\nReturn ONLY valid JSON. Do not include markdown fences or commentary.\nJSON shape:\n${input.anthropicJsonShape}`,
  });

  const raw = parseJsonFromModelText(text);
  const parsed = input.schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(formatZodIssue(parsed.error));
  }
  return parsed.data;
}

function localFallbackGameData(gameType: GameType, terms: Array<{ term: string; definition: string }>) {
  switch (gameType) {
    case GameType.Flashcards:
      return { cards: terms.slice(0, 20) };
    case GameType.Matching:
      return {
        instructions: 'Match each term to the correct definition.',
        pairs: terms.slice(0, 8).map((term, index) => ({ id: `${index + 1}`, ...term })),
      };
    case GameType.Quiz: {
      const selected = terms.slice(0, 10);
      const questions = selected.map((term, index) => {
        const otherTerms = selected.filter((_, i) => i !== index).map((t) => t.term);
        const distractors = otherTerms.slice(0, 3);
        while (distractors.length < 3) distractors.push(`Not ${term.term}`);
        const options = [...distractors, term.term].sort(() => Math.random() - 0.5);
        return {
          id: `${index + 1}`,
          prompt: `Which term best matches this definition: ${term.definition}`,
          options,
          correctIndex: options.findIndex((option) => option === term.term),
          explanation: `${term.term}: ${term.definition}`,
        };
      });
      return { title: 'Quick Quiz', questions };
    }
    default:
      return { items: [] };
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const analytics = getAnalyticsHeaders(request);
  try {
    const body = await request.json();
    const parsed = generateRouteSchema.safeParse(body);

    if (!parsed.success) {
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/generate',
        result: 'error',
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        errorCode: 'bad_request',
      });
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { mode, settings } = parsed.data;
    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/generate',
      apiMode: mode,
      provider: settings.provider,
      result: 'start',
    });
    const maxTermsPerDeck = resolveMaxTermsPerDeck(settings);

    if (mode === 'extract-terms') {
      const promptData = buildTermExtractionPrompt({
        sourceText: parsed.data.inputText,
        topic: parsed.data.topic,
        tutorInstruction: parsed.data.tutorInstruction,
      });
      const model = getLanguageModel(settings);

      try {
        const result = await generateObjectCompat({
          provider: settings.provider,
          model,
          schema: termExtractionSchema,
          system: promptData.system,
          prompt: promptData.prompt,
          anthropicJsonShape:
            '{"title":"string","description":"string","terms":[{"term":"string","definition":"string"}]}',
        });

        const response = NextResponse.json({
          ...result,
          terms: dedupeTerms(result.terms).slice(0, maxTermsPerDeck),
          source: 'llm',
        });
        await trackServerApiRequest({
          clientId: analytics.clientId,
          consent: analytics.consent,
          apiRoute: '/api/generate',
          apiMode: mode,
          provider: settings.provider,
          result: 'success',
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
          extra: { source: 'llm' },
        });
        return response;
      } catch (error) {
        const fallbackText = parsed.data.inputText ?? parsed.data.topic ?? '';
        const chunks = fallbackText
          .split(/[\.\n]+/)
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .slice(0, 12);

        const fallbackTerms = chunks.map((chunk, index) => {
          const [head, ...rest] = chunk.split(':');
          return {
            term: (head || `Concept ${index + 1}`).trim().slice(0, 80),
            definition: (rest.join(':') || chunk).trim().slice(0, 220),
          };
        });

        if (fallbackTerms.length < 4) {
          fallbackTerms.push(
            { term: 'Key Idea', definition: 'Primary concept from the input source.' },
            { term: 'Definition', definition: 'Meaning or explanation of a term.' },
            { term: 'Context', definition: 'Background information for understanding the topic.' },
            { term: 'Example', definition: 'An instance that demonstrates the concept.' },
          );
        }

        const response = NextResponse.json({
          title: parsed.data.topic?.trim() || 'New Study Set',
          description: 'Generated locally because LLM extraction was unavailable.',
          terms: dedupeTerms(fallbackTerms).slice(0, maxTermsPerDeck),
          source: 'fallback',
          warning: error instanceof Error ? error.message : 'LLM extraction failed.',
        });
        await trackServerApiRequest({
          clientId: analytics.clientId,
          consent: analytics.consent,
          apiRoute: '/api/generate',
          apiMode: mode,
          provider: settings.provider,
          result: 'success',
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
          extra: { source: 'fallback' },
        });
        return response;
      }
    }

    if (!parsed.data.gameType || !parsed.data.terms?.length) {
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/generate',
        apiMode: mode,
        provider: settings.provider,
        result: 'error',
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        errorCode: 'invalid_game_data_request',
      });
      return NextResponse.json(
        { error: 'gameType and terms are required when mode is game-data.' },
        { status: 400 },
      );
    }

    const gameType = parsed.data.gameType;
    const terms = parsed.data.terms;
    const schema = gameSchemaByType[gameType];
    const promptData = buildGamePrompt(gameType, terms);
    const model = getLanguageModel(settings);

    try {
      const result = await generateObjectCompat({
        provider: settings.provider,
        model,
        schema,
        system: promptData.system,
        prompt: promptData.prompt,
        anthropicJsonShape:
          gameType === GameType.Quiz
            ? '{"title":"string","questions":[{"id":"string","prompt":"string","options":["string","string","string","string"],"correctIndex":0,"explanation":"string"}]}'
            : gameType === GameType.Matching
              ? '{"instructions":"string","pairs":[{"id":"string","term":"string","definition":"string"}]}'
              : '{"items":[],"note":"string"}',
      });

      const response = NextResponse.json({ gameType, data: result, source: 'llm' });
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/generate',
        apiMode: mode,
        provider: settings.provider,
        result: 'success',
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        extra: { game_type: gameType, source: 'llm' },
      });
      return response;
    } catch (error) {
      const response = NextResponse.json({
        gameType,
        data: localFallbackGameData(gameType, terms),
        source: 'fallback',
        warning: error instanceof Error ? error.message : 'LLM game generation failed.',
      });
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/generate',
        apiMode: mode,
        provider: settings.provider,
        result: 'success',
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        extra: { game_type: gameType, source: 'fallback' },
      });
      return response;
    }
  } catch (error) {
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error during generation.',
      },
      { status: 500 },
    );
    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/generate',
      result: 'error',
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : 'unexpected_error',
    });
    return response;
  }
}

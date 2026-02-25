import { generateObject } from 'ai';
import { NextResponse } from 'next/server';

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
  try {
    const body = await request.json();
    const parsed = generateRouteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { mode, settings } = parsed.data;
    const maxTermsPerDeck = resolveMaxTermsPerDeck(settings);

    if (mode === 'extract-terms') {
      const promptData = buildTermExtractionPrompt({
        sourceText: parsed.data.inputText,
        topic: parsed.data.topic,
        tutorInstruction: parsed.data.tutorInstruction,
      });

      try {
        const result = await generateObject({
          model: getLanguageModel(settings),
          schema: termExtractionSchema,
          system: promptData.system,
          prompt: promptData.prompt,
        });

        return NextResponse.json({
          ...result.object,
          terms: dedupeTerms(result.object.terms).slice(0, maxTermsPerDeck),
          source: 'llm',
        });
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

        return NextResponse.json({
          title: parsed.data.topic?.trim() || 'New Study Set',
          description: 'Generated locally because LLM extraction was unavailable.',
          terms: dedupeTerms(fallbackTerms).slice(0, maxTermsPerDeck),
          source: 'fallback',
          warning: error instanceof Error ? error.message : 'LLM extraction failed.',
        });
      }
    }

    if (!parsed.data.gameType || !parsed.data.terms?.length) {
      return NextResponse.json(
        { error: 'gameType and terms are required when mode is game-data.' },
        { status: 400 },
      );
    }

    const gameType = parsed.data.gameType;
    const terms = parsed.data.terms;
    const schema = gameSchemaByType[gameType];
    const promptData = buildGamePrompt(gameType, terms);

    try {
      const result = await generateObject({
        model: getLanguageModel(settings),
        schema,
        system: promptData.system,
        prompt: promptData.prompt,
      });

      return NextResponse.json({ gameType, data: result.object, source: 'llm' });
    } catch (error) {
      return NextResponse.json({
        gameType,
        data: localFallbackGameData(gameType, terms),
        source: 'fallback',
        warning: error instanceof Error ? error.message : 'LLM game generation failed.',
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error during generation.',
      },
      { status: 500 },
    );
  }
}

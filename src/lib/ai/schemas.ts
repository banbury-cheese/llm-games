import { z } from 'zod';

import { GameType } from '@/types/game';

export const termSchema = z.object({
  term: z.string().min(1).max(120),
  definition: z.string().min(1).max(800),
});

export const termExtractionSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(240),
  terms: z.array(termSchema).min(4).max(40),
});

export const flashcardsSchema = z.object({
  cards: z.array(termSchema).min(1),
});

export const matchingPairSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const matchingGameSchema = z.object({
  instructions: z.string().min(1),
  pairs: z.array(matchingPairSchema).min(4).max(10),
});

export const quizQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});

export const quizGameSchema = z.object({
  title: z.string().min(1),
  questions: z.array(quizQuestionSchema).min(5).max(12),
});

export const genericGameDataSchema = z.object({
  items: z.array(z.unknown()),
  note: z.string(),
});

export const chatRequestSchema = z.object({
  setTitle: z.string().min(1).max(120).optional(),
  terms: z.array(termSchema).min(0).max(60),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1),
  settings: z.object({
    provider: z.enum(['openai', 'anthropic', 'google']),
    model: z.string().min(1),
    apiKey: z.string(),
  }),
});

export const generateRouteSchema = z.object({
  mode: z.enum(['extract-terms', 'game-data']),
  inputText: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  gameType: z.nativeEnum(GameType).optional(),
  terms: z.array(termSchema).optional(),
  settings: z.object({
    provider: z.enum(['openai', 'anthropic', 'google']),
    model: z.string().min(1),
    apiKey: z.string(),
  }),
});

export const gameSchemaByType = {
  [GameType.Flashcards]: flashcardsSchema,
  [GameType.Matching]: matchingGameSchema,
  [GameType.Quiz]: quizGameSchema,
  [GameType.TypeIn]: genericGameDataSchema,
  [GameType.HungryBug]: genericGameDataSchema,
  [GameType.Crossword]: genericGameDataSchema,
  [GameType.Test]: genericGameDataSchema,
  [GameType.Snowman]: genericGameDataSchema,
  [GameType.Unscramble]: genericGameDataSchema,
  [GameType.BugMatch]: genericGameDataSchema,
  [GameType.StudyTable]: genericGameDataSchema,
  [GameType.Chopped]: genericGameDataSchema,
  [GameType.ChatBot]: genericGameDataSchema,
} as const;

export type TermExtractionResult = z.infer<typeof termExtractionSchema>;
export type QuizGameData = z.infer<typeof quizGameSchema>;
export type MatchingGameData = z.infer<typeof matchingGameSchema>;

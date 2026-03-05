import { GameType, GAME_LABELS } from '@/types/game';
import type { Term } from '@/types/study-set';

type PromptTerm = Pick<Term, 'term' | 'definition'>;
type PromptTargetTerm = Pick<Term, 'id' | 'term' | 'definition'>;

function termsBlock(terms: PromptTerm[]) {
  return terms
    .map((term, index) => `${index + 1}. ${term.term}: ${term.definition}`)
    .join('\n');
}

function targetTermsBlock(terms: PromptTargetTerm[]) {
  return terms
    .map((term, index) => `${index + 1}. [${term.id}] ${term.term}: ${term.definition}`)
    .join('\n');
}

export function buildTermExtractionPrompt(input: { sourceText?: string; topic?: string; tutorInstruction?: string }) {
  const sourceText = input.sourceText?.trim();
  const topic = input.topic?.trim();
  const tutorInstruction = input.tutorInstruction?.trim();

  return {
    system:
      'You are a study-set generator. Extract clear, concise term-definition pairs suitable for learning games. Prefer accuracy over volume. Return only key concepts.',
    prompt: [
      sourceText
        ? `Extract 8-20 useful term-definition pairs from the following content. Also suggest a short title and a one-sentence description.\n\n${sourceText}`
        : null,
      topic
        ? `Generate a study set about this topic: ${topic}. Produce 8-16 foundational terms with concise definitions, plus a title and short description.`
        : null,
      tutorInstruction
        ? `Learner goal / tutor instruction (use this to prioritize what the deck should help them learn): ${tutorInstruction}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function buildGamePrompt(gameType: GameType, terms: PromptTerm[]) {
  const label = GAME_LABELS[gameType];
  const base = `Study set terms:\n${termsBlock(terms)}`;

  const promptByGame: Partial<Record<GameType, string>> = {
    [GameType.Flashcards]: `Return the same terms cleaned up for flashcards. Keep definitions short and direct.\n\n${base}`,
    [GameType.Matching]: `Create 6-8 matching pairs using the study set. Include an "instructions" string. Each pair should have id, term, and definition. Definitions must uniquely identify the term.\n\n${base}`,
    [GameType.Quiz]: `Create a short quiz title and 10 multiple-choice quiz questions from the study set. Each question must include a prompt, exactly 4 options, correctIndex (0-3), and a short explanation. Make distractors plausible but clearly wrong.\n\n${base}`,
  };

  return {
    system: `You generate structured data for the ${label} learning game. Follow the schema exactly.`,
    prompt:
      promptByGame[gameType] ??
      `Create structured starter data for the ${label} learning game using the study set below.\n\n${base}`,
  };
}

export function buildPersonalizedPackPrompt(input: {
  gameType: GameType.Quiz | GameType.TypeIn;
  targetTerms: PromptTargetTerm[];
  weakTermIds?: string[];
  tutorInstruction?: string;
}) {
  const base = `Target terms:\n${targetTermsBlock(input.targetTerms)}`;
  const tutorInstruction = input.tutorInstruction?.trim();

  if (input.gameType === GameType.Quiz) {
    return {
      system:
        'You generate adaptive quiz question packs. Output strict JSON that matches schema exactly. No markdown.',
      prompt: [
        'Create a personalized quiz pack with 16-30 multiple-choice questions.',
        'Prioritize weak terms and include plausible distractors.',
        'Each question must include: id, termId, prompt, options(4), correctIndex, explanation.',
        'Use termId as the exact bracketed id from the target terms list (e.g., "term-123").',
        tutorInstruction ? `Tutor focus to prioritize when selecting examples: ${tutorInstruction}` : null,
        input.weakTermIds?.length
          ? `Weak term ids from client signal: ${input.weakTermIds.join(', ')}`
          : null,
        base,
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  }

  return {
    system:
      'You generate adaptive type-in practice packs. Output strict JSON that matches schema exactly. No markdown.',
    prompt: [
      'Create a personalized type-in pack with 16-40 items.',
      'Each item must include: id, answer, clue. Optional hint is allowed.',
      'Prioritize weak terms and vary clue wording to deepen understanding.',
      tutorInstruction ? `Tutor focus to prioritize when writing clues: ${tutorInstruction}` : null,
      input.weakTermIds?.length ? `Weak term ids from client signal: ${input.weakTermIds.join(', ')}` : null,
      base,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function buildChatSystemPrompt(input: { setTitle?: string; terms: PromptTerm[]; tutorInstruction?: string }) {
  const heading = input.setTitle?.trim() ? `Study set: ${input.setTitle}` : 'Study set';
  const tutorInstruction = input.tutorInstruction?.trim();
  if (!input.terms.length) {
    return [
      'You are a friendly tutor helping the user learn and reason through questions.',
      'No structured term list is currently attached, so ask clarifying questions when needed and explain concepts clearly.',
      'If the user pastes a quiz question or answer choice, analyze it carefully and teach the reasoning.',
      tutorInstruction
        ? `Prioritize this user learning goal in your explanations: ${tutorInstruction}`
        : null,
      '',
      `${heading}`,
      'No term list provided for this chat yet.',
      tutorInstruction ? `Tutor focus: ${tutorInstruction}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'You are a friendly tutor helping the user learn the provided study terms.',
    'Explain concepts clearly, quiz the user when appropriate, and stay grounded in the provided terms.',
    'If a user asks something outside these terms, say so and answer briefly if still helpful.',
    tutorInstruction
      ? `Prioritize this user learning goal/focus when choosing explanations, examples, and comparisons: ${tutorInstruction}`
      : null,
    '',
    `${heading}`,
    tutorInstruction ? `Tutor focus: ${tutorInstruction}` : null,
    termsBlock(input.terms),
  ]
    .filter(Boolean)
    .join('\n');
}

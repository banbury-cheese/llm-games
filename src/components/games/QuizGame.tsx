'use client';

import { useMemo, useState } from 'react';

import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useChatTutor } from '@/lib/chat-tutor';
import type { Term } from '@/types/study-set';

import type { GameComponentProps } from '@/components/games/types';

interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

function buildFallbackQuiz(terms: Term[]): QuizQuestion[] {
  return terms.slice(0, 10).map((term, index, all) => {
    const distractors = all.filter((_, currentIndex) => currentIndex !== index).map((item) => item.term).slice(0, 3);
    while (distractors.length < 3) distractors.push(`Option ${distractors.length + 1}`);
    const options = [...distractors, term.term].sort(() => Math.random() - 0.5);

    return {
      id: `${index + 1}`,
      prompt: `Which term matches this definition: ${term.definition}`,
      options,
      correctIndex: options.findIndex((option) => option === term.term),
      explanation: `${term.term} is the correct term for the definition shown.`,
    };
  });
}

function normalizeQuestions(data: unknown, fallbackTerms: Term[]): QuizQuestion[] {
  if (
    data &&
    typeof data === 'object' &&
    'questions' in data &&
    Array.isArray((data as { questions?: unknown[] }).questions)
  ) {
    const questions = (data as { questions: unknown[] }).questions
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => {
        const options = Array.isArray(item.options) ? item.options.filter((opt): opt is string => typeof opt === 'string') : [];
        return {
          id: typeof item.id === 'string' ? item.id : `${index + 1}`,
          prompt: typeof item.prompt === 'string' ? item.prompt : '',
          options,
          correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : -1,
          explanation: typeof item.explanation === 'string' ? item.explanation : undefined,
        } satisfies QuizQuestion;
      })
      .filter(
        (question) =>
          question.prompt &&
          question.options.length === 4 &&
          question.correctIndex >= 0 &&
          question.correctIndex < question.options.length,
      );

    if (questions.length) return questions;
  }

  return buildFallbackQuiz(fallbackTerms);
}

function buildQuizExplainPrompt(question: QuizQuestion, selectedIndex: number | undefined) {
  const chosenAnswer = typeof selectedIndex === 'number' ? question.options[selectedIndex] : 'No answer selected';
  const correctAnswer = question.options[question.correctIndex];
  const isCorrect = typeof selectedIndex === 'number' && selectedIndex === question.correctIndex;

  return [
    'I am taking a quiz on this material and was given this question:',
    `'${question.prompt}'`,
    '',
    'I chose this as the answer:',
    `'${chosenAnswer}'`,
    '',
    isCorrect
      ? `That answer was correct. The correct answer is '${correctAnswer}'.`
      : `That answer was incorrect. The correct answer is '${correctAnswer}'.`,
    question.explanation ? `The quiz explanation shown was: '${question.explanation}'` : null,
    '',
    isCorrect
      ? 'Help me understand why this answer is correct and how to recognize similar questions'
      : 'Help me understand why my answer was incorrect',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function QuizGame({ studySet, data }: GameComponentProps) {
  const { trackEvent } = useAnalytics();
  const { openTutor } = useChatTutor();
  const questions = useMemo(() => normalizeQuestions(data, studySet.terms), [data, studySet.terms]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0;

  const score = useMemo(() => {
    return questions.reduce((total, question) => {
      return total + (answers[question.id] === question.correctIndex ? 1 : 0);
    }, 0);
  }, [answers, questions]);

  if (!questions.length) {
    return (
      <Card className="rounded-[28px] p-6">
        <p className="text-sm text-[var(--text-muted)]">No quiz questions available.</p>
      </Card>
    );
  }

  if (showResults) {
    return (
      <div className="space-y-4">
        <Card className="rounded-[28px] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-yellow px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-black">
                Quiz Complete
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Score: {score} / {questions.length}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Review your answers below and replay any time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowResults(false)}>
                Review Questions
              </Button>
              <Button
                type="button"
                onClick={() => {
                  trackEvent('quiz_restart', {
                    set_id: studySet.id,
                    score,
                    total_count: questions.length,
                  });
                  setAnswers({});
                  setCurrentIndex(0);
                  setShowResults(false);
                }}
              >
                Restart Quiz
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-3">
          {questions.map((question, index) => {
            const selected = answers[question.id];
            const correct = selected === question.correctIndex;
            return (
              <Card key={question.id} className="rounded-[22px] p-4 sm:p-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-muted)]">Question {index + 1}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          background: correct ? 'rgba(166,190,89,0.18)' : 'rgba(243,87,87,0.14)',
                          color: correct ? '#7f9d28' : '#d63f3f',
                        }}
                      >
                        {correct ? 'Correct' : 'Incorrect'}
                      </span>
                      {typeof selected === 'number' ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => openAiExplain(question, selected)}>
                          AI Explain
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="font-semibold leading-6">{question.prompt}</p>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => {
                      const isCorrectOption = optionIndex === question.correctIndex;
                      const isSelectedOption = optionIndex === selected;
                      return (
                        <div
                          key={option}
                          className="rounded-2xl border px-3 py-2 text-sm"
                          style={{
                            borderColor: isCorrectOption
                              ? 'rgba(166,190,89,0.6)'
                              : isSelectedOption
                                ? 'rgba(243,87,87,0.5)'
                                : 'var(--border)',
                            background: isCorrectOption ? 'rgba(166,190,89,0.08)' : 'transparent',
                          }}
                        >
                          {option}
                        </div>
                      );
                    })}
                  </div>
                  {question.explanation ? (
                    <p className="text-sm leading-6 text-[var(--text-muted)]">{question.explanation}</p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  const selectedIndex = answers[currentQuestion.id];
  const isAnswered = typeof selectedIndex === 'number';
  const isCorrect = isAnswered && selectedIndex === currentQuestion.correctIndex;
  const openAiExplain = (question: QuizQuestion, answerIndex: number | undefined) => {
    trackEvent('quiz_ai_explain_open', {
      set_id: studySet.id,
      game_type: 'quiz',
      result: typeof answerIndex === 'number' ? 'selected' : 'none',
    });
    trackEvent('quiz_ai_explain', {
      set_id: studySet.id,
      game_type: 'quiz',
    });
    openTutor({
      sessionKey: `study-set:${studySet.id}`,
      setTitle: studySet.title,
      tutorInstruction: studySet.tutorInstruction,
      terms: studySet.terms,
      initialMessage: buildQuizExplainPrompt(question, answerIndex),
      autoSend: true,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Quiz</h2>
            <p className="text-sm text-[var(--text-muted)]">10 MCQs with immediate feedback and a final score.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-3 py-2 font-semibold" style={{ borderColor: 'var(--border)' }}>
              {currentIndex + 1} / {questions.length}
            </span>
            <span className="rounded-full bg-yellow px-3 py-2 font-semibold text-black">{answeredCount} answered</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full bg-yellow transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <Card className="rounded-[28px] p-5 sm:p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Question {currentIndex + 1}</p>
            <h3 className="text-lg font-semibold leading-7 sm:text-2xl sm:leading-8">{currentQuestion.prompt}</h3>
          </div>

          <fieldset className="space-y-2">
            <legend className="sr-only">Quiz options</legend>
            {currentQuestion.options.map((option, optionIndex) => {
              const checked = selectedIndex === optionIndex;
              const correctOption = currentQuestion.correctIndex === optionIndex;
              const showCorrect = isAnswered && correctOption;
              const showWrong = isAnswered && checked && !correctOption;
              return (
                <label
                  key={`${currentQuestion.id}-${optionIndex}`}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition"
                  style={{
                    borderColor: showCorrect
                      ? 'rgba(166,190,89,0.6)'
                      : showWrong
                        ? 'rgba(243,87,87,0.6)'
                        : checked
                          ? 'rgba(127,178,255,0.55)'
                          : 'var(--border)',
                    background: showCorrect
                      ? 'rgba(166,190,89,0.08)'
                      : checked
                        ? 'rgba(127,178,255,0.08)'
                        : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    checked={checked}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
                      trackEvent('quiz_answer_select', {
                        set_id: studySet.id,
                        index: currentIndex,
                        selected: optionIndex,
                      });
                    }}
                    className="mt-1"
                  />
                  <span className="text-sm leading-6">{option}</span>
                </label>
              );
            })}
          </fieldset>

          {isAnswered ? (
            <div
              className="rounded-2xl border px-4 py-3 text-sm leading-6"
              style={{
                borderColor: isCorrect ? 'rgba(166,190,89,0.5)' : 'rgba(243,87,87,0.5)',
                background: isCorrect ? 'rgba(166,190,89,0.08)' : 'rgba(243,87,87,0.08)',
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{isCorrect ? 'Correct' : 'Not quite'}</p>
                  {currentQuestion.explanation ? <p className="mt-1">{currentQuestion.explanation}</p> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => openAiExplain(currentQuestion, selectedIndex)}
                  className="shrink-0"
                >
                  AI Explain
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                trackEvent('quiz_next_prev', {
                  set_id: studySet.id,
                  action: 'prev',
                  index: currentIndex,
                });
                setCurrentIndex((prev) => Math.max(prev - 1, 0));
              }}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              {currentIndex < questions.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    trackEvent('quiz_next_prev', {
                      set_id: studySet.id,
                      action: 'next',
                      index: currentIndex,
                    });
                    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
                  }}
                  disabled={!isAnswered}
                >
                  Next Question
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    trackEvent('quiz_finish', {
                      set_id: studySet.id,
                      score,
                      total_count: questions.length,
                    });
                    trackEvent('game_session_complete', {
                      set_id: studySet.id,
                      game_type: 'quiz',
                      score,
                      total_count: questions.length,
                      result: 'complete',
                    });
                    setShowResults(true);
                  }}
                  disabled={answeredCount !== questions.length}
                >
                  Finish Quiz
                </Button>
              )}
            </div>
          </div>

          {currentIndex === questions.length - 1 && answeredCount !== questions.length ? (
            <p className="text-xs text-[var(--text-muted)]">Answer the last question to enable finishing.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

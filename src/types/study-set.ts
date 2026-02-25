export interface Term {
  id: string;
  term: string;
  definition: string;
}

export type SourceType = 'text' | 'document' | 'topic';

export interface StudySet {
  id: string;
  title: string;
  description: string;
  tutorInstruction?: string;
  sourceType: SourceType;
  sourceContent: string;
  terms: Term[];
  createdAt: number;
  updatedAt?: number;
  gameData: Record<string, unknown>;
}

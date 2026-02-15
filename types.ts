export interface Segment {
  id: string;
  text: string;
  translation?: string; // New field for Vietnamese translation
  start: number;
  end: number;
}

export interface MiniStoryInteraction {
  id: string;
  question: string;
  answer: string;
  questionStart: number;
  questionEnd: number;
  answerStart: number;
  answerEnd: number;
}

export interface VocabularyItem {
  id: string;
  word: string;
  originalSentence: string;
  translation: string; // Vietnamese meaning in context
  definition: string; // English definition
  ipa: string; // Phonetic transcription
  examples: string[]; // List of example sentences
  topic?: string; // Topic/Category of the word
  savedAt: number;
}

export interface Article {
  id: string;
  title: string;
  createdAt: number;
  lastPracticed: number | null;
  nextReview: number;
  stage: number; // For SRS (0 = new, 1 = 1 day, etc.)
  segments: Segment[]; 
  miniStoryInteractions?: MiniStoryInteraction[];
  currentSegmentIndex: number; // Track progress
  audioBlob?: Blob; // Stored in IndexedDB
}

export enum AppTab {
  DASHBOARD = 'DASHBOARD',
  PRACTICE_NEW = 'PRACTICE_NEW',
  PRACTICE_SESSION = 'PRACTICE_SESSION',
  VOCABULARY = 'VOCABULARY'
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  REVIEW = 'REVIEW',
  PRACTICE = 'PRACTICE',
  COMPLETED = 'COMPLETED'
}

export interface ProcessingState {
  status: 'idle' | 'uploading' | 'analyzing' | 'error';
  message: string;
}
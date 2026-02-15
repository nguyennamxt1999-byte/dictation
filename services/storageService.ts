import { Article, VocabularyItem } from '../types';

const DB_NAME = 'DictationMasterDB';
const DB_VERSION = 2; // Increment version for new store
const STORE_ARTICLES = 'articles';
const STORE_VOCABULARY = 'vocabulary';

// Spaced Repetition Intervals (in days)
const SRS_INTERVALS = [1, 3, 5, 7, 14, 30, 60, 90, 120, 150];

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ARTICLES)) {
        db.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_VOCABULARY)) {
        const vocabStore = db.createObjectStore(STORE_VOCABULARY, { keyPath: 'id' });
        vocabStore.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
  });
};

// --- Articles ---

export const saveArticle = async (article: Article): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_ARTICLES, 'readwrite');
    const store = transaction.objectStore(STORE_ARTICLES);
    const request = store.put(article);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllArticles = async (): Promise<Article[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_ARTICLES, 'readonly');
    const store = transaction.objectStore(STORE_ARTICLES);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Article[];
      // Sort by nextReview ascending
      results.sort((a, b) => a.nextReview - b.nextReview);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getArticleById = async (id: string): Promise<Article | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_ARTICLES, 'readonly');
    const store = transaction.objectStore(STORE_ARTICLES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// --- Vocabulary ---

export const saveVocabulary = async (item: VocabularyItem): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_VOCABULARY, 'readwrite');
    const store = transaction.objectStore(STORE_VOCABULARY);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getVocabulary = async (): Promise<VocabularyItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_VOCABULARY, 'readonly');
    const store = transaction.objectStore(STORE_VOCABULARY);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by savedAt descending (newest first)
      const results = request.result as VocabularyItem[];
      results.sort((a, b) => b.savedAt - a.savedAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteVocabulary = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_VOCABULARY, 'readwrite');
      const store = transaction.objectStore(STORE_VOCABULARY);
      const request = store.delete(id);
  
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

// --- Logic ---

export const calculateNextReview = (currentStage: number): { nextDate: number, nextStage: number, isFinished: boolean } => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let daysToAdd = 0;
  let nextStage = currentStage + 1;
  let isFinished = false;

  if (currentStage < SRS_INTERVALS.length) {
    daysToAdd = SRS_INTERVALS[currentStage];
  } else {
    daysToAdd = 30;
  }
  
  const nextDate = now + (daysToAdd * oneDay);
  
  if (currentStage >= SRS_INTERVALS.length + 12) { 
      isFinished = true;
  }

  return { nextDate, nextStage, isFinished };
};

export const updateArticleProgress = async (id: string): Promise<void> => {
  const article = await getArticleById(id);
  if (!article) return;

  const oneYear = 365 * 24 * 60 * 60 * 1000;
  if ((Date.now() - article.createdAt) > oneYear) {
      article.lastPracticed = Date.now();
      article.nextReview = Date.now() + oneYear * 10;
      await saveArticle(article);
      return;
  }

  const { nextDate, nextStage } = calculateNextReview(article.stage);

  article.lastPracticed = Date.now();
  article.nextReview = nextDate;
  article.stage = nextStage;

  await saveArticle(article);
};
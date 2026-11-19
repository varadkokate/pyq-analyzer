import type { AnalysisResult, ModelAnswer } from '../types';

const ANALYSIS_CACHE_KEY = 'pyq_analyzer_hash_cache_v1';
const MODEL_ANSWERS_CACHE_KEY = 'pyq_analyzer_model_answers_v1';
const CUSTOM_API_KEY_STORAGE = 'pyq_analyzer_custom_api_key_v1';

const MAX_CACHED_ANALYSES = 10;
const MAX_CACHED_ANSWERS = 80;

interface CachedAnalysisEntry {
  hash: string;
  cachedAt: string;
  result: AnalysisResult;
}

export function getCachedAnalysisByHash(hash: string): AnalysisResult | null {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    const entries = JSON.parse(raw) as CachedAnalysisEntry[];
    if (!Array.isArray(entries)) return null;
    const found = entries.find((e) => e.hash === hash);
    return found ? found.result : null;
  } catch {
    return null;
  }
}

export function saveAnalysisToHashCache(hash: string, result: AnalysisResult): void {
  try {
    const raw = window.localStorage.getItem(ANALYSIS_CACHE_KEY);
    const existing: CachedAnalysisEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = Array.isArray(existing) ? existing.filter((e) => e.hash !== hash) : [];
    const updated: CachedAnalysisEntry[] = [
      { hash, cachedAt: new Date().toISOString(), result },
      ...filtered,
    ].slice(0, MAX_CACHED_ANALYSES);
    window.localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // Gracefully skip if localStorage quota is full
  }
}

function makeAnswerKey(subjectName: string, questionText: string): string {
  const normalized = `${subjectName.trim().toLowerCase()}::${questionText
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `ans-${(hash >>> 0).toString(16)}`;
}

interface StoredAnswerEntry {
  key: string;
  savedAt: number;
  answer: ModelAnswer;
}

function readStoredAnswers(): StoredAnswerEntry[] {
  try {
    const raw = window.localStorage.getItem(MODEL_ANSWERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCachedModelAnswer(
  subjectName: string,
  questionText: string
): ModelAnswer | null {
  const key = makeAnswerKey(subjectName, questionText);
  const list = readStoredAnswers();
  const match = list.find((entry) => entry.key === key);
  return match ? match.answer : null;
}

export function saveModelAnswerToCache(
  subjectName: string,
  questionText: string,
  answer: ModelAnswer
): void {
  try {
    const key = makeAnswerKey(subjectName, questionText);
    const list = readStoredAnswers().filter((entry) => entry.key !== key);
    const updated: StoredAnswerEntry[] = [
      { key, savedAt: Date.now(), answer },
      ...list,
    ].slice(0, MAX_CACHED_ANSWERS);
    window.localStorage.setItem(MODEL_ANSWERS_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

export function hydrateModelAnswersForAnalysis(
  analysis: AnalysisResult
): Record<string, ModelAnswer> {
  const hydrated: Record<string, ModelAnswer> = {};
  const subject = analysis.summary.subjectName;

  for (const q of analysis.importantQuestions) {
    const cached = getCachedModelAnswer(subject, q.questionText);
    if (cached) {
      hydrated[q.id] = cached;
    }
  }

  analysis.predictedMockPaper?.sections?.forEach((section, sIdx) => {
    section.questions.forEach((mq, qIdx) => {
      const cached = getCachedModelAnswer(subject, mq.questionText);
      if (cached) {
        hydrated[`mock-${sIdx}-${qIdx}`] = cached;
      }
    });
  });

  return hydrated;
}

export function loadCustomApiKey(): string {
  try {
    return window.localStorage.getItem(CUSTOM_API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveCustomApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) {
      window.localStorage.setItem(CUSTOM_API_KEY_STORAGE, trimmed);
    } else {
      window.localStorage.removeItem(CUSTOM_API_KEY_STORAGE);
    }
  } catch {
    // Ignore storage errors
  }
}

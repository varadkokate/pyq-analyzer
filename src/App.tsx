import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Database, Plus, Printer, RefreshCw } from 'lucide-react';
import { TopBar } from './components/TopBar';
import type { ActiveView } from './components/TopBar';
import { UploadWorkspace } from './components/UploadWorkspace';
import type { AnalysisErrorState } from './components/UploadWorkspace';
import { ImportantQuestionsView } from './components/ImportantQuestionsView';
import { TopicWeightageView } from './components/TopicWeightageView';
import { PredictedMockPaperView } from './components/PredictedMockPaperView';
import { PrintableReport } from './components/PrintableReport';
import type { PrintMode } from './components/PrintableReport';
import { WatermarkOverlay } from './components/WatermarkOverlay';
import { ApiKeyModal } from './components/ApiKeyModal';
import { createSamplePaperFiles } from './data/samplePapers';
import { computePapersFingerprint, preparePapersForUpload } from './utils/fileExtractor';
import {
  getCachedAnalysisByHash,
  getCachedModelAnswer,
  hydrateModelAnswersForAnalysis,
  loadCustomApiKey,
  saveAnalysisToHashCache,
  saveCustomApiKey,
  saveModelAnswerToCache,
} from './utils/cache';
import type { AnalysisResult, ImportantQuestion, ModelAnswer } from './types';

const RECENT_STORAGE_KEY = 'pyq_analyzer_recent_v1';
const THEME_STORAGE_KEY = 'pyq_analyzer_theme_v1';
const MAX_RECENT_ANALYSES = 6;
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15 MB total

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.docx', '.txt'];

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function loadRecentAnalyses(): AnalysisResult[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getInitialTheme(): 'light' | 'dark' {
  try {
    if (document.documentElement.classList.contains('dark')) return 'dark';
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Fallback to light
  }
  return 'light';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());
  const [activeView, setActiveView] = useState<ActiveView>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [examTag, setExamTag] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<AnalysisErrorState | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>(() =>
    loadRecentAnalyses()
  );

  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [modelAnswers, setModelAnswers] = useState<Record<string, ModelAnswer>>({});
  const [loadingAnswerIds, setLoadingAnswerIds] = useState<Record<string, boolean>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string | null>>({});
  const [printMode, setPrintMode] = useState<PrintMode>('important');

  const [customApiKey, setCustomApiKey] = useState<string>(() => loadCustomApiKey());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify(recentAnalyses.slice(0, MAX_RECENT_ANALYSES))
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [recentAnalyses]);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSaveCustomApiKey = useCallback((key: string) => {
    saveCustomApiKey(key);
    setCustomApiKey(key);
    // Reset rate limit countdown immediately if user switched keys
    setRetryCountdown(0);
    setAnalysisError(null);
  }, []);

  const handleAddFiles = useCallback((incoming: File[]) => {
    setAnalysisError(null);
    setLimitWarning(null);

    const unsupported: string[] = [];
    const validIncoming: File[] = [];

    for (const file of incoming) {
      if (isSupportedFile(file)) {
        validIncoming.push(file);
      } else {
        unsupported.push(file.name);
      }
    }

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const next = [...prev];
      let currentBytes = prev.reduce((sum, f) => sum + f.size, 0);
      const skippedByCount: string[] = [];
      const skippedBySize: string[] = [];

      for (const file of validIncoming) {
        const key = `${file.name}-${file.size}`;
        if (existingKeys.has(key)) continue;

        if (next.length >= MAX_FILES) {
          skippedByCount.push(file.name);
          continue;
        }
        if (currentBytes + file.size > MAX_TOTAL_BYTES) {
          skippedBySize.push(file.name);
          continue;
        }
        existingKeys.add(key);
        next.push(file);
        currentBytes += file.size;
      }

      const warnings: string[] = [];
      if (unsupported.length > 0) {
        warnings.push(`Unsupported format skipped: ${unsupported.join(', ')}.`);
      }
      if (skippedByCount.length > 0) {
        warnings.push(
          `Maximum ${MAX_FILES} files allowed per analysis. Skipped: ${skippedByCount.join(', ')}.`
        );
      }
      if (skippedBySize.length > 0) {
        warnings.push(
          `Total upload limit is 15 MB. Skipped to stay under limit: ${skippedBySize.join(', ')}.`
        );
      }
      if (warnings.length > 0) {
        setLimitWarning(warnings.join(' '));
      }

      return next;
    });
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
    setLimitWarning(null);
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setAnalysisError(null);
    setLimitWarning(null);
    setRetryCountdown(0);
  }, []);

  const handleLoadSamples = useCallback(() => {
    const sample = createSamplePaperFiles();
    setFiles(sample.files);
    setSubjectName(sample.subjectName);
    setExamTag(sample.examTag);
    setAnalysisError(null);
    setLimitWarning(null);
    setRetryCountdown(0);
    setActiveView('upload');
  }, []);

  const runAnalysis = useCallback(
    async (options?: { forceReanalyze?: boolean }) => {
      const forceReanalyze = Boolean(options?.forceReanalyze);
      if (files.length === 0 || isSubmittingRef.current) return;

      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      if (files.length > MAX_FILES || totalBytes > MAX_TOTAL_BYTES) {
        setLimitWarning(
          `Please keep uploads within ${MAX_FILES} files and 15 MB total before analyzing.`
        );
        return;
      }

      isSubmittingRef.current = true;
      setIsAnalyzing(true);
      setAnalysisError(null);
      setLimitWarning(null);
      setProgressNote('Extracting text from digital PDFs, DOCX, and TXT locally...');

      try {
        // Step 1: Extract plain text locally on client side for digital PDFs/DOCX/TXT
        const batch = await preparePapersForUpload(files);
        const fingerprint = await computePapersFingerprint({
          files,
          subjectName,
          examTag,
          extractedTexts: batch.extractedTexts,
        });

        // Step 2: Check smart localStorage cache before spending any API tokens
        if (!forceReanalyze) {
          const cached = getCachedAnalysisByHash(fingerprint);
          if (cached) {
            setCurrentAnalysis(cached);
            setLoadedFromCache(true);
            setSelectedTopic('all');
            setModelAnswers(hydrateModelAnswersForAnalysis(cached));
            setLoadingAnswerIds({});
            setAnswerErrors({});
            setActiveView('questions');
            return;
          }
        }

        const extractedCount = batch.extractedTexts.length;
        const binaryCount = batch.binaryFiles.length;
        setProgressNote(
          `Sending ${extractedCount} text-extracted ${
            extractedCount === 1 ? 'paper' : 'papers'
          }${binaryCount > 0 ? ` + ${binaryCount} scanned ${binaryCount === 1 ? 'file' : 'files'}` : ''} in a single Gemini Flash call...`
        );

        const formData = new FormData();
        if (batch.extractedTexts.length > 0) {
          formData.append('extractedTexts', JSON.stringify(batch.extractedTexts));
        }
        batch.binaryFiles.forEach((file) => {
          formData.append('files', file);
        });
        if (subjectName.trim()) {
          formData.append('subjectName', subjectName.trim());
        }
        if (examTag.trim()) {
          formData.append('examTag', examTag.trim());
        }

        const headers: Record<string, string> = {};
        if (customApiKey.trim()) {
          headers['x-gemini-api-key'] = customApiKey.trim();
        }

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: formData,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const isRateLimited =
            response.status === 429 ||
            response.status === 503 ||
            data?.code === 'RATE_LIMITED' ||
            data?.code === 'SERVICE_UNAVAILABLE';
          const isAuthError = response.status === 403 || data?.code === 'AUTH_ERROR';

          if (isRateLimited) {
            const waitSec =
              typeof data?.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0
                ? data.retryAfterSeconds
                : 30;
            setRetryCountdown(waitSec);
          }

          setAnalysisError({
            message:
              typeof data?.error === 'string'
                ? data.error
                : `Analysis failed with status ${response.status}.`,
            isRateLimited,
            isAuthError,
          });
          setActiveView('upload');
          return;
        }

        const result = data as AnalysisResult;
        saveAnalysisToHashCache(fingerprint, result);

        setCurrentAnalysis(result);
        setLoadedFromCache(false);
        setSelectedTopic('all');
        setModelAnswers(hydrateModelAnswersForAnalysis(result));
        setLoadingAnswerIds({});
        setAnswerErrors({});
        setRecentAnalyses((prev) =>
          [result, ...prev.filter((item) => item.id !== result.id)].slice(0, MAX_RECENT_ANALYSES)
        );
        setActiveView('questions');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected network error occurred while analyzing your papers.';
        setAnalysisError({ message });
        setActiveView('upload');
      } finally {
        isSubmittingRef.current = false;
        setIsAnalyzing(false);
        setProgressNote(null);
      }
    },
    [files, subjectName, examTag, customApiKey]
  );

  const handleAnalyze = useCallback(() => {
    void runAnalysis({ forceReanalyze: false });
  }, [runAnalysis]);

  const handleForceReanalyze = useCallback(() => {
    if (files.length === 0) {
      setActiveView('upload');
      setLimitWarning('Re-select your exam paper files to run a fresh Gemini analysis.');
      return;
    }
    void runAnalysis({ forceReanalyze: true });
  }, [files.length, runAnalysis]);

  const handleOpenRecent = useCallback((analysis: AnalysisResult) => {
    setCurrentAnalysis(analysis);
    setLoadedFromCache(true);
    setSelectedTopic('all');
    setModelAnswers(hydrateModelAnswersForAnalysis(analysis));
    setLoadingAnswerIds({});
    setAnswerErrors({});
    setAnalysisError(null);
    setActiveView('questions');
  }, []);

  const handleDeleteRecent = useCallback((id: string) => {
    setRecentAnalyses((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleGenerateModelAnswer = useCallback(
    async (question: ImportantQuestion) => {
      if (!currentAnalysis) return;

      // Check state & localStorage cache first — 0 API tokens if already generated!
      const cachedAnswer =
        modelAnswers[question.id] ??
        getCachedModelAnswer(currentAnalysis.summary.subjectName, question.questionText);
      if (cachedAnswer) {
        setModelAnswers((prev) => ({ ...prev, [question.id]: cachedAnswer }));
        return;
      }

      if (loadingAnswerIds[question.id]) return;

      setLoadingAnswerIds((prev) => ({ ...prev, [question.id]: true }));
      setAnswerErrors((prev) => ({ ...prev, [question.id]: null }));

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customApiKey.trim()) {
          headers['x-gemini-api-key'] = customApiKey.trim();
        }

        const response = await fetch('/api/model-answer', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            questionText: question.questionText,
            topic: question.topic,
            estimatedMarks: question.estimatedMarks,
            subjectName: currentAnalysis.summary.subjectName,
            examTag: currentAnalysis.summary.examTag,
            appearedIn: question.appearedIn,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : `Could not generate model answer (HTTP ${response.status}).`
          );
        }

        const answer = data as ModelAnswer;
        saveModelAnswerToCache(currentAnalysis.summary.subjectName, question.questionText, answer);
        setModelAnswers((prev) => ({ ...prev, [question.id]: answer }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to fetch model answer. Please try again.';
        setAnswerErrors((prev) => ({ ...prev, [question.id]: message }));
      } finally {
        setLoadingAnswerIds((prev) => ({ ...prev, [question.id]: false }));
      }
    },
    [currentAnalysis, customApiKey, modelAnswers, loadingAnswerIds]
  );

  const triggerPrint = useCallback((mode: PrintMode) => {
    setPrintMode(mode);
    window.setTimeout(() => {
      window.print();
    }, 60);
  }, []);

  const handleInspectTopic = useCallback((topic: string) => {
    setSelectedTopic(topic);
    setActiveView('questions');
  }, []);

  const uniqueTopics = useMemo(() => {
    if (!currentAnalysis) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const item of currentAnalysis.topicWeightage) {
      if (item.topic && !seen.has(item.topic)) {
        seen.add(item.topic);
        list.push(item.topic);
      }
    }
    for (const q of currentAnalysis.importantQuestions) {
      if (q.topic && !seen.has(q.topic)) {
        seen.add(q.topic);
        list.push(q.topic);
      }
    }
    return list;
  }, [currentAnalysis]);

  const topTopic = currentAnalysis?.topicWeightage?.[0] ?? null;

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Transparent Watermark (Website + Exported PDF) */}
      <WatermarkOverlay />

      <TopBar
        activeView={activeView}
        hasAnalysis={Boolean(currentAnalysis)}
        isAnalyzing={isAnalyzing}
        theme={theme}
        hasCustomApiKey={customApiKey.trim().length > 0}
        onToggleTheme={handleToggleTheme}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onSelectView={(view) => {
          if (view === 'upload') setActiveView('upload');
          else if (currentAnalysis) setActiveView(view);
        }}
        onExportPrint={() => triggerPrint(activeView === 'mock' ? 'mock' : 'important')}
        onLoadSamples={handleLoadSamples}
      />

      <main className="no-print relative z-10 flex-1">
        {activeView === 'upload' || !currentAnalysis ? (
          <UploadWorkspace
            files={files}
            maxFiles={MAX_FILES}
            maxTotalBytes={MAX_TOTAL_BYTES}
            subjectName={subjectName}
            examTag={examTag}
            isAnalyzing={isAnalyzing}
            progressNote={progressNote}
            limitWarning={limitWarning}
            error={analysisError}
            retryCountdown={retryCountdown}
            recentAnalyses={recentAnalyses}
            hasCustomApiKey={customApiKey.trim().length > 0}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
            onClearFiles={handleClearFiles}
            onSubjectNameChange={setSubjectName}
            onExamTagChange={setExamTag}
            onAnalyze={handleAnalyze}
            onLoadSamples={handleLoadSamples}
            onOpenRecent={handleOpenRecent}
            onDeleteRecent={handleDeleteRecent}
            onDismissError={() => setAnalysisError(null)}
            onDismissWarning={() => setLimitWarning(null)}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Cache Status Bar when loaded with 0 API calls */}
            {loadedFromCache && (
              <div className="bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-900/70 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                  <Database
                    className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="font-medium">Loaded from cache (0 API calls)</span>
                  <span className="hidden sm:inline text-emerald-700 dark:text-emerald-400">
                    · Identical paper set matched in browser storage
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleForceReanalyze}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100/60 dark:hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Force Re-analyze</span>
                </button>
              </div>
            )}

            {/* Subject Header & Summary KPI Strip */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {currentAnalysis.summary.subjectName}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {currentAnalysis.summary.examTag} · Analyzed{' '}
                    {currentAnalysis.summary.totalPapersAnalyzed}{' '}
                    {currentAnalysis.summary.totalPapersAnalyzed === 1 ? 'paper' : 'papers'} (
                    {currentAnalysis.sourceFiles.join(', ')})
                  </p>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
                    {currentAnalysis.summary.keyInsight}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveView('upload')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>New Analysis</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPrint('important')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Export Sheet as PDF</span>
                  </button>
                </div>
              </div>

              {/* 4-Column Tabular Summary Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-200 dark:divide-slate-800">
                <div className="p-4 sm:px-6">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Papers Analyzed
                  </p>
                  <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {currentAnalysis.summary.totalPapersAnalyzed}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {currentAnalysis.summary.totalQuestionsExtracted} raw questions parsed
                  </p>
                </div>

                <div className="p-4 sm:px-6">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Ranked Concepts
                  </p>
                  <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {currentAnalysis.summary.totalUniqueConcepts}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Semantically grouped
                  </p>
                </div>

                <div className="p-4 sm:px-6">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    High Priority
                  </p>
                  <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-red-700 dark:text-red-400">
                    {currentAnalysis.summary.highPriorityCount}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Core recurring questions
                  </p>
                </div>

                <div className="p-4 sm:px-6">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Highest-Weight Topic
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {topTopic ? topTopic.topic : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {topTopic ? `${topTopic.percentage}% of total questions` : 'No data'}
                  </p>
                </div>
              </div>
            </section>

            {/* Workspace Sub-Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Analysis report views"
                className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-800/90 rounded-lg overflow-x-auto max-w-full"
              >
                {(
                  [
                    {
                      id: 'questions',
                      label: 'Important Questions',
                      count: currentAnalysis.importantQuestions.length,
                    },
                    {
                      id: 'weightage',
                      label: 'Topic Weightage',
                      count: currentAnalysis.topicWeightage.length,
                    },
                    {
                      id: 'mock',
                      label: 'Predicted Mock Paper',
                      count: currentAnalysis.predictedMockPaper?.sections?.reduce(
                        (sum, s) => sum + s.questions.length,
                        0
                      ),
                    },
                  ] as const
                ).map((tab) => {
                  const isActive = activeView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      onClick={() => setActiveView(tab.id)}
                      className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        isActive
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {tab.label}
                      {typeof tab.count === 'number' && (
                        <span className="ml-1.5 font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Report Panel */}
            {activeView === 'questions' && (
              <ImportantQuestionsView
                questions={currentAnalysis.importantQuestions}
                topics={uniqueTopics}
                selectedTopic={selectedTopic}
                onSelectTopic={setSelectedTopic}
                modelAnswers={modelAnswers}
                loadingAnswerIds={loadingAnswerIds}
                answerErrors={answerErrors}
                onGenerateModelAnswer={handleGenerateModelAnswer}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            )}

            {activeView === 'weightage' && (
              <TopicWeightageView
                topicWeightage={currentAnalysis.topicWeightage}
                isDark={theme === 'dark'}
                onInspectTopic={handleInspectTopic}
              />
            )}

            {activeView === 'mock' && (
              <PredictedMockPaperView
                mockPaper={currentAnalysis.predictedMockPaper}
                modelAnswers={modelAnswers}
                loadingAnswerIds={loadingAnswerIds}
                answerErrors={answerErrors}
                onGenerateModelAnswer={handleGenerateModelAnswer}
                onPrintMockPaper={() => triggerPrint('mock')}
                onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="no-print relative z-10 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <p>
            PYQ Analyzer · <span className="font-mono">pyq-analyzer-by-vk</span>
          </p>
          <p>Max 5 files (15 MB total) · Client-side extraction · Local smart cache</p>
        </div>
      </footer>

      {/* Optional BYOK API Key Settings Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        savedKey={customApiKey}
        onSaveKey={handleSaveCustomApiKey}
        onClose={() => setIsApiKeyModalOpen(false)}
      />

      {/* Dedicated Print / PDF Export Sheet */}
      {currentAnalysis && (
        <PrintableReport
          analysis={currentAnalysis}
          modelAnswers={modelAnswers}
          printMode={printMode}
        />
      )}
    </div>
  );
}

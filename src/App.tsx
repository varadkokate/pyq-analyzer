import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Printer } from 'lucide-react';
import { TopBar } from './components/TopBar';
import type { ActiveView } from './components/TopBar';
import { UploadWorkspace } from './components/UploadWorkspace';
import { ImportantQuestionsView } from './components/ImportantQuestionsView';
import { TopicWeightageView } from './components/TopicWeightageView';
import { PredictedMockPaperView } from './components/PredictedMockPaperView';
import { PrintableReport } from './components/PrintableReport';
import type { PrintMode } from './components/PrintableReport';
import { WatermarkOverlay } from './components/WatermarkOverlay';
import { createSamplePaperFiles } from './data/samplePapers';
import type { AnalysisResult, ImportantQuestion, ModelAnswer } from './types';

const RECENT_STORAGE_KEY = 'pyq_analyzer_recent_v1';
const THEME_STORAGE_KEY = 'pyq_analyzer_theme_v1';
const MAX_RECENT_ANALYSES = 6;

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
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>(() =>
    loadRecentAnalyses()
  );

  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [modelAnswers, setModelAnswers] = useState<Record<string, ModelAnswer>>({});
  const [loadingAnswerIds, setLoadingAnswerIds] = useState<Record<string, boolean>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string | null>>({});
  const [printMode, setPrintMode] = useState<PrintMode>('important');

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

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleAddFiles = useCallback((incoming: File[]) => {
    setAnalysisError(null);
    const rejected: string[] = [];
    const accepted: File[] = [];

    for (const file of incoming) {
      if (isSupportedFile(file)) {
        accepted.push(file);
      } else {
        rejected.push(file.name);
      }
    }

    if (rejected.length > 0) {
      setAnalysisError(
        `Skipped unsupported file(s): ${rejected.join(', ')}. Supported formats: PDF, JPG, PNG, DOCX, TXT.`
      );
    }

    if (accepted.length > 0) {
      setFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
        const deduped = accepted.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
        return [...prev, ...deduped].slice(0, 20);
      });
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setAnalysisError(null);
  }, []);

  const handleLoadSamples = useCallback(() => {
    const sample = createSamplePaperFiles();
    setFiles(sample.files);
    setSubjectName(sample.subjectName);
    setExamTag(sample.examTag);
    setAnalysisError(null);
    setActiveView('upload');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (files.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      if (subjectName.trim()) {
        formData.append('subjectName', subjectName.trim());
      }
      if (examTag.trim()) {
        formData.append('examTag', examTag.trim());
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `Analysis failed with status ${response.status}.`
        );
      }

      const result = data as AnalysisResult;
      setCurrentAnalysis(result);
      setSelectedTopic('all');
      setModelAnswers({});
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
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, subjectName, examTag, isAnalyzing]);

  const handleOpenRecent = useCallback((analysis: AnalysisResult) => {
    setCurrentAnalysis(analysis);
    setSelectedTopic('all');
    setModelAnswers({});
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

      setLoadingAnswerIds((prev) => ({ ...prev, [question.id]: true }));
      setAnswerErrors((prev) => ({ ...prev, [question.id]: null }));

      try {
        const response = await fetch('/api/model-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

        setModelAnswers((prev) => ({ ...prev, [question.id]: data as ModelAnswer }));
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
    [currentAnalysis]
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
        onToggleTheme={handleToggleTheme}
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
            subjectName={subjectName}
            examTag={examTag}
            isAnalyzing={isAnalyzing}
            error={analysisError}
            recentAnalyses={recentAnalyses}
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
          />
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
          <p>Supports PDF, JPG/PNG scans, DOCX, and TXT</p>
        </div>
      </footer>

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

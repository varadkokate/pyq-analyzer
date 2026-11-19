import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { ImportantQuestion, ModelAnswer, PriorityTier } from '../types';
import { ModelAnswerPanel } from './ModelAnswerPanel';

type MarksFilter = 'all' | 'short' | 'medium' | 'long';
type SortKey = 'rank' | 'frequency' | 'marks';

interface ImportantQuestionsViewProps {
  questions: ImportantQuestion[];
  topics: string[];
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  modelAnswers: Record<string, ModelAnswer>;
  loadingAnswerIds: Record<string, boolean>;
  answerErrors: Record<string, string | null>;
  onGenerateModelAnswer: (question: ImportantQuestion) => void;
  onOpenApiKeyModal?: () => void;
}

const PRIORITY_STYLES: Record<PriorityTier, { text: string; symbol: string }> = {
  High: { text: 'text-red-700 dark:text-red-400 font-semibold', symbol: '▲' },
  Medium: { text: 'text-amber-700 dark:text-amber-400 font-semibold', symbol: '◆' },
  Low: { text: 'text-slate-600 dark:text-slate-400 font-medium', symbol: '○' },
};

export function ImportantQuestionsView({
  questions,
  topics,
  selectedTopic,
  onSelectTopic,
  modelAnswers,
  loadingAnswerIds,
  answerErrors,
  onGenerateModelAnswer,
  onOpenApiKeyModal,
}: ImportantQuestionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'All' | PriorityTier>('All');
  const [marksFilter, setMarksFilter] = useState<MarksFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [expandedAnswerIds, setExpandedAnswerIds] = useState<Record<string, boolean>>({});
  const [expandedVariantIds, setExpandedVariantIds] = useState<Record<string, boolean>>({});

  const priorityCounts = useMemo(() => {
    const counts = { All: questions.length, High: 0, Medium: 0, Low: 0 };
    for (const q of questions) {
      counts[q.priority] += 1;
    }
    return counts;
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = questions.filter((q) => {
      if (priorityFilter !== 'All' && q.priority !== priorityFilter) return false;
      if (selectedTopic !== 'all' && q.topic !== selectedTopic) return false;

      if (marksFilter === 'short' && q.estimatedMarks > 4) return false;
      if (marksFilter === 'medium' && (q.estimatedMarks < 5 || q.estimatedMarks > 8)) return false;
      if (marksFilter === 'long' && q.estimatedMarks < 9) return false;

      if (query) {
        const inQuestion = q.questionText.toLowerCase().includes(query);
        const inTopic = q.topic.toLowerCase().includes(query);
        const inYears = q.appearedIn.some((yr) => yr.toLowerCase().includes(query));
        const inVariants = q.variantExamples.some((v) => v.toLowerCase().includes(query));
        if (!inQuestion && !inTopic && !inYears && !inVariants) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortKey === 'frequency') {
        return b.frequencyCount - a.frequencyCount || b.estimatedMarks - a.estimatedMarks;
      }
      if (sortKey === 'marks') {
        return b.estimatedMarks - a.estimatedMarks || b.frequencyCount - a.frequencyCount;
      }
      return a.rank - b.rank;
    });
  }, [questions, priorityFilter, selectedTopic, marksFilter, searchQuery, sortKey]);

  const hasActiveFilters =
    priorityFilter !== 'All' ||
    selectedTopic !== 'all' ||
    marksFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setPriorityFilter('All');
    onSelectTopic('all');
    setMarksFilter('all');
    setSearchQuery('');
  };

  const handleAnswerButtonClick = (q: ImportantQuestion) => {
    const hasAnswer = Boolean(modelAnswers[q.id]);
    const isCurrentlyOpen = Boolean(expandedAnswerIds[q.id]);

    if (hasAnswer) {
      setExpandedAnswerIds((prev) => ({ ...prev, [q.id]: !isCurrentlyOpen }));
      return;
    }

    setExpandedAnswerIds((prev) => ({ ...prev, [q.id]: true }));
    onGenerateModelAnswer(q);
  };

  const toggleVariants = (id: string) => {
    setExpandedVariantIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-5">
      {/* Interactive Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Priority Segmented Control */}
          <div
            role="group"
            aria-label="Filter by priority"
            className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto max-w-full"
          >
            {(['All', 'High', 'Medium', 'Low'] as const).map((tier) => {
              const isActive = priorityFilter === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPriorityFilter(tier)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tier}{' '}
                  <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 ml-0.5">
                    {priorityCounts[tier]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions, topics, or years..."
              aria-label="Search important questions"
              className="w-full h-9 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
        </div>

        {/* Secondary Filter Selects Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="topic-filter"
                className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
              >
                Topic
              </label>
              <select
                id="topic-filter"
                value={selectedTopic}
                onChange={(e) => onSelectTopic(e.target.value)}
                className="h-9 pl-3 pr-8 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[240px]"
              >
                <option value="all">All Topics ({topics.length})</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="marks-filter"
                className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
              >
                Marks
              </label>
              <select
                id="marks-filter"
                value={marksFilter}
                onChange={(e) => setMarksFilter(e.target.value as MarksFilter)}
                className="h-9 pl-3 pr-8 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Marks</option>
                <option value="short">Short (1–4 Marks)</option>
                <option value="medium">Medium (5–8 Marks)</option>
                <option value="long">Long (9+ Marks)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-order"
                className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
              >
                Sort
              </label>
              <select
                id="sort-order"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-9 pl-3 pr-8 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="rank">Importance Rank</option>
                <option value="frequency">Highest Frequency</option>
                <option value="marks">Highest Marks</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Showing {filteredQuestions.length} of {questions.length}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty Filter State */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No questions match your current filters
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try clearing your search term or selecting a broader priority, topic, or marks bracket.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Reset Filters</span>
          </button>
        </div>
      ) : (
        /* Ranked Question List — Single-Elevation Surface with Hairline Dividers */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {filteredQuestions.map((q) => {
            const pStyle = PRIORITY_STYLES[q.priority];
            const isAnswerOpen = Boolean(expandedAnswerIds[q.id]);
            const hasAnswer = Boolean(modelAnswers[q.id]);
            const isLoadingAnswer = Boolean(loadingAnswerIds[q.id]);
            const answerError = answerErrors[q.id];
            const isVariantsOpen = Boolean(expandedVariantIds[q.id]);

            return (
              <article key={q.id} className="p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-6">
                  {/* Left: Rank + Question Text */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span className="font-mono text-sm font-semibold text-slate-400 dark:text-slate-500 tabular-nums pt-0.5 shrink-0">
                      {String(q.rank).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-base font-medium text-slate-900 dark:text-slate-100 leading-snug"
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        {q.questionText}
                      </h3>

                      {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className={pStyle.text}>
                          <span aria-hidden="true" className="mr-1 text-[10px]">
                            {pStyle.symbol}
                          </span>
                          {q.priority} Priority
                        </span>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => onSelectTopic(q.topic)}
                          className="text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 underline-offset-2 hover:underline font-medium"
                        >
                          {q.topic}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span>
                          Appeared in:{' '}
                          <span className="text-slate-700 dark:text-slate-300">
                            {q.appearedIn.join(', ')}
                          </span>
                        </span>
                      </div>

                      {/* Examiner Study Tip */}
                      {q.studyTip && (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Focus:{' '}
                          </span>
                          {q.studyTip}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Tabular Frequency & Marks Metric Block */}
                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-3 sm:gap-1 pl-8 sm:pl-0 shrink-0 font-mono tabular-nums">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {q.marksLabel || `${q.estimatedMarks} Marks`}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Asked {q.frequencyCount}×
                    </span>
                  </div>
                </div>

                {/* Action Row: Generate Model Answer + Past Variants Disclosure */}
                <div className="mt-4 pl-0 sm:pl-8 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleAnswerButtonClick(q)}
                      disabled={isLoadingAnswer}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        isAnswerOpen && hasAnswer
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                          : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {isLoadingAnswer
                          ? 'Generating Model Answer...'
                          : hasAnswer
                            ? isAnswerOpen
                              ? 'Hide Model Answer'
                              : 'Show Model Answer'
                            : 'Generate Model Answer'}
                      </span>
                    </button>

                    {q.variantExamples && q.variantExamples.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleVariants(q.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors whitespace-nowrap"
                      >
                        <span>
                          {q.variantExamples.length}{' '}
                          {q.variantExamples.length === 1 ? 'past wording' : 'past wordings'}
                        </span>
                        {isVariantsOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Past Wording Variants */}
                {isVariantsOpen && q.variantExamples.length > 0 && (
                  <div className="mt-3 sm:ml-8 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      Alternate phrasings grouped into this concept
                    </p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {q.variantExamples.map((variant, idx) => (
                        <li key={idx} className="leading-relaxed">
                          &ldquo;{variant}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Model Answer Panel */}
                {isAnswerOpen && (
                  <div className="sm:ml-8">
                    <ModelAnswerPanel
                      answer={modelAnswers[q.id]}
                      isLoading={isLoadingAnswer}
                      error={answerError}
                      onRetry={() => onGenerateModelAnswer(q)}
                      onOpenApiKeyModal={onOpenApiKeyModal}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

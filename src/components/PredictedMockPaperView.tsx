import { useState } from 'react';
import { BookOpen, Eye, EyeOff, Printer } from 'lucide-react';
import type { ImportantQuestion, ModelAnswer, PredictedMockPaper } from '../types';
import { ModelAnswerPanel } from './ModelAnswerPanel';

interface PredictedMockPaperViewProps {
  mockPaper: PredictedMockPaper;
  modelAnswers: Record<string, ModelAnswer>;
  loadingAnswerIds: Record<string, boolean>;
  answerErrors: Record<string, string | null>;
  onGenerateModelAnswer: (question: ImportantQuestion) => void;
  onPrintMockPaper: () => void;
}

export function PredictedMockPaperView({
  mockPaper,
  modelAnswers,
  loadingAnswerIds,
  answerErrors,
  onGenerateModelAnswer,
  onPrintMockPaper,
}: PredictedMockPaperViewProps) {
  const [showHints, setShowHints] = useState(false);
  const [expandedAnswerIds, setExpandedAnswerIds] = useState<Record<string, boolean>>({});

  if (!mockPaper || !mockPaper.sections || mockPaper.sections.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Predicted Mock Paper unavailable
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Run a fresh analysis to synthesize a practice exam from your papers.
        </p>
      </div>
    );
  }

  const handleToggleAnswer = (
    key: string,
    questionText: string,
    topic: string,
    marks: number,
    priority: 'High' | 'Medium' | 'Low'
  ) => {
    const hasAnswer = Boolean(modelAnswers[key]);
    const isOpen = Boolean(expandedAnswerIds[key]);

    if (hasAnswer) {
      setExpandedAnswerIds((prev) => ({ ...prev, [key]: !isOpen }));
      return;
    }

    setExpandedAnswerIds((prev) => ({ ...prev, [key]: true }));
    onGenerateModelAnswer({
      id: key,
      rank: 0,
      questionText,
      topic,
      frequencyCount: 1,
      appearedIn: ['Predicted Mock Paper'],
      estimatedMarks: marks,
      marksLabel: `${marks} Marks`,
      priority,
      variantExamples: [],
      studyTip: '',
    });
  };

  const hours = Math.floor(mockPaper.durationMinutes / 60);
  const mins = mockPaper.durationMinutes % 60;
  const durationLabel =
    hours > 0
      ? mins > 0
        ? `${hours} hr ${mins} min`
        : `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`
      : `${mins} Minutes`;

  return (
    <div className="space-y-4">
      {/* Paper Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Synthesized practice exam weighted toward your highest-priority topics
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHints((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            {showHints ? (
              <>
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hide Topic Hints</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Show Topic Hints</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onPrintMockPaper}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print Mock Paper</span>
          </button>
        </div>
      </div>

      {/* Authentic Exam Paper Sheet */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-10">
        {/* Paper Masthead */}
        <header className="pb-6 border-b border-slate-300 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {mockPaper.title}
              </h2>
              {mockPaper.subtitle && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {mockPaper.subtitle}
                </p>
              )}
            </div>
            <div className="text-sm font-mono tabular-nums text-slate-800 dark:text-slate-200 sm:text-right shrink-0">
              <p>Time: {durationLabel}</p>
              <p>Maximum Marks: {mockPaper.totalMarks}</p>
            </div>
          </div>

          {mockPaper.generalInstructions && mockPaper.generalInstructions.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                General Instructions
              </p>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400 list-disc pl-4">
                {mockPaper.generalInstructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* Sections */}
        <div className="mt-8 space-y-10">
          {mockPaper.sections.map((section, sIdx) => (
            <section key={`${section.sectionName}-${sIdx}`}>
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {section.sectionName}
                  </h3>
                  {section.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {section.description}
                    </p>
                  )}
                </div>
                {section.instructions && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {section.instructions}
                  </p>
                )}
              </div>

              <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {section.questions.map((mq, qIdx) => {
                  const answerKey = `mock-${sIdx}-${qIdx}`;
                  const isOpen = Boolean(expandedAnswerIds[answerKey]);
                  const hasAnswer = Boolean(modelAnswers[answerKey]);
                  const isLoading = Boolean(loadingAnswerIds[answerKey]);
                  const error = answerErrors[answerKey];

                  return (
                    <li key={answerKey} className="py-4 first:pt-2 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0 pt-0.5">
                            {mq.number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-relaxed">
                              {mq.questionText}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                              <span>{mq.topic}</span>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleAnswer(
                                    answerKey,
                                    mq.questionText,
                                    mq.topic,
                                    mq.marks,
                                    mq.priority
                                  )
                                }
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap"
                              >
                                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {isLoading
                                    ? 'Generating Answer...'
                                    : hasAnswer
                                      ? isOpen
                                        ? 'Hide Model Answer'
                                        : 'Show Model Answer'
                                      : 'Generate Model Answer'}
                                </span>
                              </button>
                            </div>

                            {showHints && mq.hint && (
                              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  Hint:{' '}
                                </span>
                                {mq.hint}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap shrink-0">
                          [{mq.marks}]
                        </span>
                      </div>

                      {isOpen && (
                        <div className="sm:ml-9">
                          <ModelAnswerPanel
                            answer={modelAnswers[answerKey]}
                            isLoading={isLoading}
                            error={error}
                            onRetry={() =>
                              onGenerateModelAnswer({
                                id: answerKey,
                                rank: 0,
                                questionText: mq.questionText,
                                topic: mq.topic,
                                frequencyCount: 1,
                                appearedIn: ['Predicted Mock Paper'],
                                estimatedMarks: mq.marks,
                                marksLabel: `${mq.marks} Marks`,
                                priority: mq.priority,
                                variantExamples: [],
                                studyTip: '',
                              })
                            }
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

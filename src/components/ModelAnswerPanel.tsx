import { useState } from 'react';
import { AlertCircle, Check, Copy, RefreshCw } from 'lucide-react';
import type { ModelAnswer } from '../types';

interface ModelAnswerPanelProps {
  answer?: ModelAnswer;
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
}

export function ModelAnswerPanel({
  answer,
  isLoading,
  error,
  onRetry,
}: ModelAnswerPanelProps) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-5 animate-pulse">
        <div className="h-3.5 w-40 bg-slate-200 rounded" />
        <div className="mt-4 space-y-2.5">
          <div className="h-3 w-full bg-slate-200 rounded" />
          <div className="h-3 w-11/12 bg-slate-200 rounded" />
          <div className="h-3 w-4/5 bg-slate-200 rounded" />
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-3 w-3/4 bg-slate-200 rounded" />
          <div className="h-3 w-2/3 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-800 bg-white border border-red-200 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!answer) return null;

  const handleCopy = async () => {
    const sections = [
      'MODEL ANSWER',
      answer.directAnswer,
      '',
      'KEY SCORING POINTS:',
      ...answer.keyPoints.map((pt, i) => `${i + 1}. ${pt}`),
    ];
    if (answer.formulaOrDiagramNote?.trim()) {
      sections.push('', 'KEY FORMULA / DIAGRAM:', answer.formulaOrDiagramNote);
    }
    if (answer.markingSchemeBreakdown?.length > 0) {
      sections.push(
        '',
        'MARKING SCHEME:',
        ...answer.markingSchemeBreakdown.map((m) => `- ${m.point} (${m.marks})`)
      );
    }
    if (answer.commonMistakeToAvoid?.trim()) {
      sections.push('', 'AVOID THIS MISTAKE:', answer.commonMistakeToAvoid);
    }

    try {
      await navigator.clipboard.writeText(sections.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  return (
    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <h4 className="text-xs font-semibold tracking-wide text-slate-700">
          Exam-Ready Model Answer
        </h4>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded px-1.5 py-0.5"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
              <span className="text-emerald-700">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy Answer</span>
            </>
          )}
        </button>
      </div>

      {/* Direct Answer */}
      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
        {answer.directAnswer}
      </div>

      {/* Key Scoring Points */}
      {answer.keyPoints && answer.keyPoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Key Scoring Points</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {answer.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="font-mono text-xs text-slate-400 tabular-nums mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, '0')}.
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formula / Diagram Note */}
      {answer.formulaOrDiagramNote && answer.formulaOrDiagramNote.trim().length > 0 && (
        <div className="bg-white border border-slate-200 rounded-md p-3.5">
          <p className="text-xs font-semibold text-slate-700 mb-1">Formula / Diagram to Include</p>
          <p className="text-xs sm:text-sm font-mono text-slate-800 leading-relaxed whitespace-pre-line">
            {answer.formulaOrDiagramNote}
          </p>
        </div>
      )}

      {/* Marking Scheme Breakdown */}
      {answer.markingSchemeBreakdown && answer.markingSchemeBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Typical Marking Scheme</p>
          <div className="border-t border-slate-200 divide-y divide-slate-200/80">
            {answer.markingSchemeBreakdown.map((row, idx) => (
              <div
                key={idx}
                className="py-2 flex items-baseline justify-between gap-4 text-xs sm:text-sm"
              >
                <span className="text-slate-700">{row.point}</span>
                <span className="font-mono tabular-nums text-slate-900 font-medium whitespace-nowrap shrink-0">
                  {row.marks}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Mistake */}
      {answer.commonMistakeToAvoid && answer.commonMistakeToAvoid.trim().length > 0 && (
        <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-amber-800">Avoid this mistake: </span>
          {answer.commonMistakeToAvoid}
        </div>
      )}
    </div>
  );
}

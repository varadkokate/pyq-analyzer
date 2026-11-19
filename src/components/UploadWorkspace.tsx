import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  FileImage,
  FileText,
  FileType2,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AnalysisResult } from '../types';

interface UploadWorkspaceProps {
  files: File[];
  subjectName: string;
  examTag: string;
  isAnalyzing: boolean;
  error: string | null;
  recentAnalyses: AnalysisResult[];
  onAddFiles: (incoming: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onSubjectNameChange: (value: string) => void;
  onExamTagChange: (value: string) => void;
  onAnalyze: () => void;
  onLoadSamples: () => void;
  onOpenRecent: (analysis: AnalysisResult) => void;
  onDeleteRecent: (id: string) => void;
  onDismissError: () => void;
}

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.txt';

const PROGRESS_STAGES = [
  {
    title: 'Reading & extracting exam papers',
    detail: 'Parsing PDFs, scanned images, Word documents, and text files on the server.',
    thresholdSec: 0,
  },
  {
    title: 'Grouping semantically equivalent questions',
    detail: 'Merging repeated concepts asked with different wordings across multiple years.',
    thresholdSec: 5,
  },
  {
    title: 'Computing topic-wise weightage & marks',
    detail: 'Scoring chapter distribution, frequency counts, and High/Medium/Low priority tiers.',
    thresholdSec: 12,
  },
  {
    title: 'Drafting your predicted mock paper',
    detail: 'Assembling a full practice paper weighted toward the highest-probability units.',
    thresholdSec: 20,
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileFormatLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
  return ext;
}

function FileFormatIcon({ filename }: { filename: string }) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
    return <FileImage className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />;
  }
  if (lower.endsWith('.pdf')) {
    return <FileType2 className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />;
  }
  return <FileText className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />;
}

export function UploadWorkspace({
  files,
  subjectName,
  examTag,
  isAnalyzing,
  error,
  recentAnalyses,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  onSubjectNameChange,
  onExamTagChange,
  onAnalyze,
  onLoadSamples,
  onOpenRecent,
  onDeleteRecent,
  onDismissError,
}: UploadWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAnalyzing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAnalyzing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isAnalyzing) return;
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      onAddFiles(dropped);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      onAddFiles(selected);
    }
    e.target.value = '';
  };

  const activeStageIndex = PROGRESS_STAGES.reduce((acc, stage, idx) => {
    return elapsedSeconds >= stage.thresholdSec ? idx : acc;
  }, 0);

  const formattedElapsed = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(
    elapsedSeconds % 60
  ).padStart(2, '0')}`;

  if (isAnalyzing) {
    const progressPercent = Math.min(92, 16 + activeStageIndex * 22 + (elapsedSeconds % 7) * 2);

    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                Analyzing your exam papers
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Processing {files.length} {files.length === 1 ? 'paper' : 'papers'}
                {subjectName.trim() ? ` · ${subjectName.trim()}` : ''}
                {examTag.trim() ? ` · ${examTag.trim()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 font-mono tabular-nums">
              <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>{formattedElapsed}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Sequential Stages */}
          <ol className="mt-8 divide-y divide-slate-100">
            {PROGRESS_STAGES.map((stage, idx) => {
              const isDone = idx < activeStageIndex;
              const isCurrent = idx === activeStageIndex;
              return (
                <li key={stage.title} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-slate-400 border border-slate-200 text-xs font-mono tabular-nums">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? 'text-slate-900'
                            : isDone
                              ? 'text-slate-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {stage.title}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          isDone
                            ? 'text-emerald-700'
                            : isCurrent
                              ? 'text-blue-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {isDone ? 'Completed' : isCurrent ? 'In progress' : 'Queued'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">{stage.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 pt-5 border-t border-slate-100 text-xs text-slate-500">
            Files in queue:{' '}
            <span className="text-slate-700">
              {files.map((f) => f.name).join(' · ')}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Editorial Intro Header */}
      <div className="max-w-3xl">
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
          style={{ textWrap: 'balance' }}
        >
          Turn previous years&apos; question papers into a focused exam roadmap
        </h1>
        <p className="mt-3 text-base text-slate-600 leading-relaxed max-w-2xl">
          Upload multiple years of PDFs, scanned photos, Word documents, or text papers at once.
          We group recurring concepts across wordings, calculate chapter weightage, and build a
          predicted mock paper.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-900">Analysis could not be completed</p>
              <p className="mt-0.5 text-sm text-red-800">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="p-1 text-red-700 hover:text-red-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 2-Column Workspace Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Primary Column: Upload Form & Queue */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          {/* Optional Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-200">
            <div>
              <label
                htmlFor="subject-name"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Subject Name <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="subject-name"
                type="text"
                value={subjectName}
                onChange={(e) => onSubjectNameChange(e.target.value)}
                placeholder="e.g., Operating Systems, Organic Chemistry"
                className="w-full h-10 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
              />
            </div>

            <div>
              <label
                htmlFor="exam-tag"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                Exam / University Tag <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="exam-tag"
                type="text"
                value={examTag}
                onChange={(e) => onExamTagChange(e.target.value)}
                placeholder="e.g., Semester IV · Mumbai University"
                className="w-full h-10 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
              />
            </div>
          </div>

          {/* Drag-and-Drop Zone */}
          <div className="mt-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
              className="sr-only"
              id="pyq-file-input"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload exam question paper files"
              className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                isDragOver
                  ? 'border-blue-600 bg-blue-50/70'
                  : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <div className="mx-auto w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-700">
                <Upload className="w-5 h-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">
                Drop exam question papers here, or click to browse
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                Supports PDF · JPG / PNG scans · DOCX · TXT · Up to 20 files (25 MB each)
              </p>
            </div>
          </div>

          {/* Uploaded File Queue */}
          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                <p className="text-sm font-semibold text-slate-800">
                  Queued Papers{' '}
                  <span className="font-mono tabular-nums text-slate-500 font-normal">
                    ({files.length})
                  </span>
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                  >
                    Add more files
                  </button>
                  <button
                    type="button"
                    onClick={onClearFiles}
                    className="font-medium text-slate-500 hover:text-red-700 whitespace-nowrap"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-slate-100">
                {files.map((file, idx) => (
                  <li
                    key={`${file.name}-${file.size}-${idx}`}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileFormatIcon filename={file.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 font-mono tabular-nums">
                          {getFileFormatLabel(file.name)} · {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(idx)}
                      aria-label={`Remove ${file.name}`}
                      className="p-2 text-slate-400 hover:text-red-700 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Primary Action Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              type="button"
              onClick={onLoadSamples}
              className="text-sm font-medium text-slate-600 hover:text-blue-700 text-left transition-colors whitespace-nowrap"
            >
              No papers handy? Load 3 sample Operating Systems PYQs
            </button>

            <button
              type="button"
              disabled={files.length === 0}
              onClick={onAnalyze}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>
                Analyze {files.length > 0 ? `${files.length} ${files.length === 1 ? 'Paper' : 'Papers'}` : 'Papers'}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right Context Column: Methodology & Recent Sessions */}
        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">What You Receive</h2>
            <ol className="mt-4 divide-y divide-slate-100 text-sm">
              <li className="py-3.5 first:pt-0">
                <p className="font-medium text-slate-900">01. Ranked Important Questions</p>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Questions testing the same concept across years are merged with exact year citations,
                  frequency counts, estimated marks, and High / Medium / Low priority.
                </p>
              </li>
              <li className="py-3.5">
                <p className="font-medium text-slate-900">02. Topic-Wise Weightage</p>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Interactive Bar and Pie charts breaking down each chapter&apos;s share of exam
                  questions and marks so you allocate revision hours wisely.
                </p>
              </li>
              <li className="py-3.5 last:pb-0">
                <p className="font-medium text-slate-900">03. Model Answers &amp; Mock Paper</p>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Generate concise, marking-scheme-ready answers on click and practice with a
                  full predicted mock paper built from top-priority topics.
                </p>
              </li>
            </ol>
          </div>

          {recentAnalyses.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-slate-900">Recent Analyses</h2>
              <p className="mt-1 text-xs text-slate-500">Saved locally in your browser</p>
              <ul className="mt-4 divide-y divide-slate-100">
                {recentAnalyses.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenRecent(item)}
                      className="text-left min-w-0 flex-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                    >
                      <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                        {item.summary.subjectName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {item.summary.totalPapersAnalyzed}{' '}
                        {item.summary.totalPapersAnalyzed === 1 ? 'paper' : 'papers'} ·{' '}
                        {item.summary.totalUniqueConcepts} concepts ·{' '}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecent(item.id)}
                      aria-label={`Delete ${item.summary.subjectName} analysis`}
                      className="p-1.5 text-slate-400 hover:text-red-700 rounded transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

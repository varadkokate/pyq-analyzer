import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  FileImage,
  FileText,
  FileType2,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AnalysisResult } from '../types';

export interface AnalysisErrorState {
  message: string;
  isRateLimited?: boolean;
  isAuthError?: boolean;
}

interface UploadWorkspaceProps {
  files: File[];
  maxFiles: number;
  maxTotalBytes: number;
  subjectName: string;
  examTag: string;
  isAnalyzing: boolean;
  progressNote: string | null;
  limitWarning: string | null;
  error: AnalysisErrorState | null;
  retryCountdown: number;
  recentAnalyses: AnalysisResult[];
  hasCustomApiKey: boolean;
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
  onDismissWarning: () => void;
  onOpenApiKeyModal: () => void;
}

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.txt';

const PROGRESS_STAGES = [
  {
    title: 'Extracting plain text locally & checking cache',
    detail: 'Digital PDFs, DOCX, and TXT are parsed in your browser so only compact text is sent.',
    thresholdSec: 0,
  },
  {
    title: 'Running single-pass Gemini Flash analysis',
    detail: 'Semantically grouping repeated questions across years in one lightweight structured call.',
    thresholdSec: 3,
  },
  {
    title: 'Scoring topic weightage & predicted mock paper',
    detail: 'Finalizing chapter percentages, priority tiers, and your 1-paper practice test.',
    thresholdSec: 8,
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

function getExtractionHint(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
    return 'Vision OCR';
  }
  if (lower.endsWith('.pdf')) {
    return 'Client text extraction (OCR if scanned)';
  }
  return 'Client text extraction';
}

function FileFormatIcon({ filename }: { filename: string }) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
    return <FileImage className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />;
  }
  if (lower.endsWith('.pdf')) {
    return <FileType2 className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />;
  }
  return <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />;
}

export function UploadWorkspace({
  files,
  maxFiles,
  maxTotalBytes,
  subjectName,
  examTag,
  isAnalyzing,
  progressNote,
  limitWarning,
  error,
  retryCountdown,
  recentAnalyses,
  hasCustomApiKey,
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
  onDismissWarning,
  onOpenApiKeyModal,
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

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const maxTotalMB = (maxTotalBytes / (1024 * 1024)).toFixed(0);
  const isAtFileLimit = files.length >= maxFiles;

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
    const progressPercent = Math.min(92, 22 + activeStageIndex * 28 + (elapsedSeconds % 5) * 2);

    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Analyzing your exam papers
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                Processing {files.length} {files.length === 1 ? 'paper' : 'papers'}
                {subjectName.trim() ? ` · ${subjectName.trim()}` : ''}
                {examTag.trim() ? ` · ${examTag.trim()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-mono tabular-nums">
              <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <span>{formattedElapsed}</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 dark:bg-blue-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progressNote && (
              <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">{progressNote}</p>
            )}
          </div>

          <ol className="mt-8 divide-y divide-slate-100 dark:divide-slate-800">
            {PROGRESS_STAGES.map((stage, idx) => {
              const isDone = idx < activeStageIndex;
              const isCurrent = idx === activeStageIndex;
              return (
                <li key={stage.title} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p
                        className={`text-sm font-medium ${
                          isCurrent
                            ? 'text-slate-900 dark:text-slate-100'
                            : isDone
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {stage.title}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          isDone
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isCurrent
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {isDone ? 'Completed' : isCurrent ? 'In progress' : 'Queued'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {stage.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Files in queue:{' '}
            <span className="text-slate-700 dark:text-slate-300">
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
          className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          style={{ textWrap: 'balance' }}
        >
          Turn previous years&apos; question papers into a focused exam roadmap
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
          Upload multiple years of PDFs, scanned photos, Word documents, or text papers at once.
          Digital text is extracted locally in your browser to minimize tokens, then analyzed in a
          single structured pass.
        </p>
      </div>

      {/* Upload Limit Warning Banner */}
      {limitWarning && (
        <div
          role="status"
          className="mt-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/70 rounded-xl p-4 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Upload limit notice
              </p>
              <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">{limitWarning}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissWarning}
            aria-label="Dismiss upload limit warning"
            className="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error / Graceful Rate-Limit Banner */}
      {error && (
        <div
          role="alert"
          className={`mt-6 rounded-xl p-4 sm:p-5 border ${
            error.isRateLimited
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/70'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/70'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {error.isRateLimited ? (
                <Clock
                  className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    error.isRateLimited
                      ? 'text-amber-950 dark:text-amber-200'
                      : 'text-red-900 dark:text-red-200'
                  }`}
                >
                  {error.isRateLimited
                    ? 'Gemini quota is temporarily busy'
                    : 'Analysis could not be completed'}
                </p>
                <p
                  className={`mt-0.5 text-sm ${
                    error.isRateLimited
                      ? 'text-amber-900 dark:text-amber-300'
                      : 'text-red-800 dark:text-red-300'
                  }`}
                >
                  {error.message}
                </p>

                {(error.isRateLimited || error.isAuthError) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {error.isRateLimited && (
                      <button
                        type="button"
                        disabled={retryCountdown > 0 || files.length === 0 || isAnalyzing}
                        onClick={onAnalyze}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-900 text-white hover:bg-amber-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap font-mono tabular-nums"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {retryCountdown > 0
                            ? `Retry in ${retryCountdown}s`
                            : 'Retry Now'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onOpenApiKeyModal}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {hasCustomApiKey ? 'Update Custom API Key' : 'Use Your Own API Key'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDismissError}
              aria-label="Dismiss error"
              className={`p-1 rounded focus-visible:outline-none focus-visible:ring-2 ${
                error.isRateLimited
                  ? 'text-amber-700 dark:text-amber-400 hover:text-amber-900 focus-visible:ring-amber-600'
                  : 'text-red-700 dark:text-red-400 hover:text-red-900 focus-visible:ring-red-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Workspace Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Primary Column: Upload Form & Queue */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
          {/* Optional Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <label
                htmlFor="subject-name"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5"
              >
                Subject Name{' '}
                <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                id="subject-name"
                type="text"
                value={subjectName}
                onChange={(e) => onSubjectNameChange(e.target.value)}
                placeholder="e.g., Operating Systems, Organic Chemistry"
                className="w-full h-10 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
              />
            </div>

            <div>
              <label
                htmlFor="exam-tag"
                className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5"
              >
                Exam / University Tag{' '}
                <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                id="exam-tag"
                type="text"
                value={examTag}
                onChange={(e) => onExamTagChange(e.target.value)}
                placeholder="e.g., Semester IV · Mumbai University"
                className="w-full h-10 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
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
              disabled={isAnalyzing}
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!isAnalyzing) fileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isAnalyzing) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload exam question paper files"
              className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                isDragOver
                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-950'
              }`}
            >
              <div className="mx-auto w-11 h-11 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-700 dark:text-blue-400">
                <Upload className="w-5 h-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Drop exam question papers here, or click to browse
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                PDF · JPG / PNG scans · DOCX · TXT · Max {maxFiles} files · {maxTotalMB} MB total
              </p>
            </div>
          </div>

          {/* Uploaded File Queue */}
          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Queued Papers{' '}
                  <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 font-normal ml-1">
                    {files.length}/{maxFiles} files · {formatFileSize(totalBytes)} / {maxTotalMB} MB
                  </span>
                </p>
                <div className="flex items-center gap-4 text-xs">
                  {!isAtFileLimit && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 whitespace-nowrap"
                    >
                      Add more files
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClearFiles}
                    className="font-medium text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 whitespace-nowrap"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {files.map((file, idx) => (
                  <li
                    key={`${file.name}-${file.size}-${idx}`}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileFormatIcon filename={file.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {getFileFormatLabel(file.name)} · {formatFileSize(file.size)}{' '}
                          <span className="font-sans text-slate-400 dark:text-slate-500">
                            · {getExtractionHint(file.name)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(idx)}
                      aria-label={`Remove ${file.name}`}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Primary Action Footer */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              type="button"
              onClick={onLoadSamples}
              disabled={isAnalyzing}
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 text-left transition-colors whitespace-nowrap disabled:opacity-50"
            >
              No papers handy? Load 3 sample Operating Systems PYQs
            </button>

            <button
              type="button"
              disabled={files.length === 0 || isAnalyzing || retryCountdown > 0}
              onClick={onAnalyze}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <span>
                {retryCountdown > 0
                  ? `Wait ${retryCountdown}s to Retry`
                  : `Analyze ${
                      files.length > 0
                        ? `${files.length} ${files.length === 1 ? 'Paper' : 'Papers'}`
                        : 'Papers'
                    }`}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right Context Column: Efficiency & Recent Sessions */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              How It Minimizes Token Usage
            </h2>
            <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <li className="py-3 first:pt-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  01. Local Text Extraction
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed text-xs sm:text-sm">
                  Digital PDFs, DOCX, and TXT files are converted to compact plain text in your
                  browser. Only scanned images or image-only PDFs use Vision OCR.
                </p>
              </li>
              <li className="py-3">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  02. Single Structured Call
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed text-xs sm:text-sm">
                  Important Questions, Topic Weightage, and the Predicted Mock Paper are generated
                  together in one lightweight Gemini Flash request.
                </p>
              </li>
              <li className="py-3 last:pb-0">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  03. Instant Browser Cache
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed text-xs sm:text-sm">
                  Re-uploading the same papers or reopening a generated model answer loads instantly
                  from localStorage with 0 API calls.
                </p>
              </li>
            </ol>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {hasCustomApiKey ? 'Custom fallback key active' : 'Using default app quota'}
              </span>
              <button
                type="button"
                onClick={onOpenApiKeyModal}
                className="font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                API Key Settings
              </button>
            </div>
          </div>

          {recentAnalyses.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Recent Analyses
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Saved locally in your browser (0 API calls to reopen)
              </p>
              <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {recentAnalyses.map((item) => (
                  <li
                    key={item.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenRecent(item)}
                      className="text-left min-w-0 flex-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate transition-colors">
                        {item.summary.subjectName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
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
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-700 dark:hover:text-red-400 rounded transition-colors shrink-0"
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

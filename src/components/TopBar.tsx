import { Printer, Sparkles } from 'lucide-react';

export type ActiveView = 'upload' | 'questions' | 'weightage' | 'mock';

interface TopBarProps {
  activeView: ActiveView;
  hasAnalysis: boolean;
  isAnalyzing: boolean;
  onSelectView: (view: ActiveView) => void;
  onExportPrint: () => void;
  onLoadSamples: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveView; label: string; requiresAnalysis?: boolean }> = [
  { id: 'upload', label: 'Upload Papers' },
  { id: 'questions', label: 'Important Questions', requiresAnalysis: true },
  { id: 'weightage', label: 'Topic Weightage', requiresAnalysis: true },
  { id: 'mock', label: 'Mock Paper', requiresAnalysis: true },
];

export function TopBar({
  activeView,
  hasAnalysis,
  isAnalyzing,
  onSelectView,
  onExportPrint,
  onLoadSamples,
}: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView(hasAnalysis ? 'questions' : 'upload')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          PYQ Analyzer
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const disabled = Boolean(item.requiresAnalysis && !hasAnalysis) || isAnalyzing;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectView(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded ${
                  isActive
                    ? 'text-blue-700 font-semibold'
                    : disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-0.5 bg-blue-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {hasAnalysis && activeView !== 'upload' ? (
            <button
              type="button"
              onClick={onExportPrint}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Export / Print</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onLoadSamples}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Load Sample Papers</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile view navigation strip (kept within mobile sticky cap) */}
      {hasAnalysis && !isAnalyzing && (
        <nav
          aria-label="Mobile view navigation"
          className="md:hidden border-t border-slate-100 bg-white overflow-x-auto"
        >
          <div className="flex items-center gap-1 px-3 py-1.5 min-w-max">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

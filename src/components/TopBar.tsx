import { KeyRound, Moon, Printer, Sparkles, Sun } from 'lucide-react';

export type ActiveView = 'upload' | 'questions' | 'weightage' | 'mock';

interface TopBarProps {
  activeView: ActiveView;
  hasAnalysis: boolean;
  isAnalyzing: boolean;
  theme: 'light' | 'dark';
  hasCustomApiKey: boolean;
  onToggleTheme: () => void;
  onOpenApiKeyModal: () => void;
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
  theme,
  hasCustomApiKey,
  onToggleTheme,
  onOpenApiKeyModal,
  onSelectView,
  onExportPrint,
  onLoadSamples,
}: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView(hasAnalysis ? 'questions' : 'upload')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded"
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
                    ? 'text-blue-700 dark:text-blue-400 font-semibold'
                    : disabled
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-0.5 bg-blue-700 dark:bg-blue-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Utility Icons + Single Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenApiKeyModal}
            aria-label={
              hasCustomApiKey
                ? 'API Key Settings (Custom fallback key active)'
                : 'API Key Settings'
            }
            title={
              hasCustomApiKey
                ? 'API Key Settings — Custom fallback key active'
                : 'API Key Settings (Optional BYOK fallback)'
            }
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
              hasCustomApiKey
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {hasAnalysis && activeView !== 'upload' ? (
            <button
              type="button"
              onClick={onExportPrint}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Export / Print</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onLoadSamples}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Load Sample Papers</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile view navigation strip */}
      {hasAnalysis && !isAnalyzing && (
        <nav
          aria-label="Mobile view navigation"
          className="md:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto"
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
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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

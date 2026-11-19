import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Trash2, X } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  savedKey: string;
  onSaveKey: (key: string) => void;
  onClose: () => void;
}

export function ApiKeyModal({
  isOpen,
  savedKey,
  onSaveKey,
  onClose,
}: ApiKeyModalProps) {
  const [draftKey, setDraftKey] = useState(savedKey);
  const [showKey, setShowKey] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraftKey(savedKey);
      setShowKey(false);
      setJustSaved(false);
    }
  }, [isOpen, savedKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasSavedKey = savedKey.trim().length > 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(draftKey.trim());
    setJustSaved(true);
    window.setTimeout(() => {
      onClose();
    }, 450);
  };

  const handleClear = () => {
    setDraftKey('');
    onSaveKey('');
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <KeyRound
              className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0"
              aria-hidden="true"
            />
            <h2
              id="api-key-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              API Key Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API Key Settings"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              Optional fallback: paste your own Gemini API key if the shared quota is temporarily
              busy.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your key is stored <strong className="font-medium text-slate-700 dark:text-slate-300">only in this browser&apos;s localStorage</strong> and forwarded only when you trigger an analysis or model answer. Leave blank to use the default app quota.
            </p>
          </div>

          <div className="text-xs flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Active Key Source</span>
            <span
              className={`font-medium ${
                hasSavedKey
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {hasSavedKey ? 'Custom browser key active' : 'Default app quota'}
            </span>
          </div>

          <div>
            <label
              htmlFor="custom-gemini-key"
              className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5"
            >
              Gemini API Key
            </label>
            <div className="relative">
              <input
                id="custom-gemini-key"
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
                className="w-full h-10 pl-3.5 pr-10 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            {hasSavedKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:underline whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Saved Key</span>
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
              >
                {justSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save Key</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

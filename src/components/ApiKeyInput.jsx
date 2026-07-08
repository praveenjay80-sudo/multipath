import { useState } from 'react';

function EyeIcon({ open }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <ellipse cx="7" cy="7" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.5 1.5l11 11M6 3.2C6.3 3.07 6.64 3 7 3c2.76 0 5 1.79 5 4 0 .46-.1.9-.28 1.3M2.4 5.4C2.14 5.9 2 6.44 2 7c0 2.21 2.24 4 5 4 .8 0 1.56-.17 2.22-.47" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

function KeyField({ storageKey, label, placeholder, description, linkText, linkHref, optional }) {
  const [draft, setDraft] = useState(() => localStorage.getItem(storageKey) || '');
  const [saved, setSaved] = useState(() => !!localStorage.getItem(storageKey));
  const [reveal, setReveal] = useState(false);

  function save() {
    const v = draft.trim();
    if (!v) return;
    localStorage.setItem(storageKey, v);
    setSaved(true);
  }

  function clear() {
    localStorage.removeItem(storageKey);
    setDraft('');
    setSaved(false);
  }

  return (
    <div className="py-4 border-b border-stone-100 last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-1.5 h-1.5 inline-block shrink-0 ${saved ? 'bg-emerald-500' : optional ? 'bg-stone-300' : 'bg-amber-400'}`} />
        <span className="text-xs text-stone-600 font-medium">{label}</span>
        {optional && <span className="text-xs text-stone-300">optional</span>}
        {!saved && !optional && <span className="text-xs text-amber-600">required</span>}
      </div>
      <p className="text-xs text-stone-400 mb-2.5 leading-relaxed pl-3.5">
        {description}{' '}
        {linkHref && (
          <a href={linkHref} target="_blank" rel="noreferrer" className="text-stone-500 underline hover:text-stone-800">
            {linkText}
          </a>
        )}
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={reveal ? 'text' : 'password'}
            value={draft}
            onChange={e => { setDraft(e.target.value); setSaved(false); }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors font-mono pr-9"
          />
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-600 transition-colors"
          >
            <EyeIcon open={reveal} />
          </button>
        </div>
        <button
          onClick={save}
          disabled={!draft.trim() || saved}
          className="px-4 py-2 text-xs bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
        {saved && (
          <button
            onClick={clear}
            className="px-4 py-2 text-xs border border-stone-200 text-stone-500 hover:bg-stone-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function ApiKeyInput() {
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const [open, setOpen] = useState(() =>
    !localStorage.getItem('canon_api_key') && !import.meta.env.VITE_ANTHROPIC_API_KEY
  );

  const anthropicSaved = !!localStorage.getItem('canon_api_key');

  return (
    <div className="mb-8 border border-stone-200 bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500 font-medium">Settings</span>
          <div className="flex items-center gap-1.5">
            {envKey ? (
              <span className="flex items-center gap-1 text-xs text-stone-400">
                <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" /> env key
              </span>
            ) : (
              <span className={`flex items-center gap-1 text-xs ${anthropicSaved ? 'text-stone-400' : 'text-amber-600'}`}>
                <span className={`w-1.5 h-1.5 inline-block ${anthropicSaved ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                Anthropic {anthropicSaved ? 'set' : 'required'}
              </span>
            )}
          </div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-stone-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
        </svg>
      </button>

      {open && (
        <div className="px-4 border-t border-stone-100">
          {envKey ? (
            <div className="py-4 text-xs text-stone-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 inline-block" />
              Anthropic API key loaded from <code className="bg-stone-100 px-1">VITE_ANTHROPIC_API_KEY</code>
            </div>
          ) : (
            <KeyField
              storageKey="canon_api_key"
              label="Anthropic API Key"
              placeholder="sk-ant-..."
              description="Used for canon generation. Stored in this browser only."
              linkText="console.anthropic.com"
              linkHref="https://console.anthropic.com/settings/keys"
            />
          )}
          <KeyField
            storageKey="canon_serp_key"
            label="SerpAPI Key"
            placeholder="serpapi key..."
            description="Used for Google Scholar results in Pulse and canon cross-validation. Stored in this browser only."
            linkText="serpapi.com"
            linkHref="https://serpapi.com/manage-api-key"
            optional
          />
        </div>
      )}
    </div>
  );
}

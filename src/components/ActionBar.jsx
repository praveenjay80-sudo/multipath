import { useState } from 'react';

export default function ActionBar({ onCopy, onSave, onRegenerate, onNew, disabled }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleCopy() {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSave() {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mt-8 pt-6 border-t border-stone-200 flex flex-wrap gap-2">
      <button
        onClick={handleCopy}
        disabled={disabled}
        className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-40"
      >
        {copied ? 'Copied!' : 'Copy Markdown'}
      </button>

      <button
        onClick={handleSave}
        disabled={disabled}
        className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-40"
      >
        {saved ? 'Saved!' : 'Save Canon'}
      </button>

      <button
        onClick={onRegenerate}
        disabled={disabled}
        className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-40"
      >
        Regenerate
      </button>

      <button
        onClick={onNew}
        className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
      >
        New Canon
      </button>
    </div>
  );
}

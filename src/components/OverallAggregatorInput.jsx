import { useState } from 'react';

export default function OverallAggregatorInput({ onRun, disabled }) {
  const [value, setValue] = useState('');
  const [shake, setShake] = useState(false);

  function handleSubmit() {
    if (!value.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }
    onRun(value.trim());
  }

  return (
    <div className="mt-2">
      <div className={`flex gap-0 ${shake ? 'animate-shake' : ''}`}>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !disabled && handleSubmit()}
          placeholder="Enter any question or topic — e.g. &quot;consciousness&quot;, &quot;what causes inflation?&quot;, &quot;the hard problem of free will&quot;"
          disabled={disabled}
          className="flex-1 px-4 py-3 text-sm border border-stone-300 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-6 py-3 text-sm font-mono font-bold bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          RUN ALL
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        9 sections generate in parallel — orientation, historical development, intellectual landscape, hidden assumptions, cross-disciplinary synthesis, essential works, prerequisites, open frontier, and mastery path.
      </p>
    </div>
  );
}

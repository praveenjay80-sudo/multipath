import { useState } from 'react';

const EXAMPLES = [
  'Machine Learning',
  'Evolutionary Biology',
  'Macroeconomics',
  'Social Psychology',
  'Quantum Physics',
  'Political Theory',
];

export default function CanonDriftInput({ onGenerate, disabled }) {
  const [input, setInput] = useState('');

  function handleSubmit() {
    const v = input.trim();
    if (!v || disabled) return;
    onGenerate(v);
  }

  return (
    <div>
      <p className="text-xs text-stone-400 mb-2">Enter a field to see how its canon has shifted across eras — what rose, what faded, and where it is heading.</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Enter any academic field..."
          disabled={disabled}
          className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="px-5 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          Trace Drift
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setInput(ex)}
            disabled={disabled}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

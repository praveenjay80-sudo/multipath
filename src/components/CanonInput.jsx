import { useRef } from 'react';
import { EXAMPLES } from '../constants/examples';

export default function CanonInput({ value, onChange, onGenerate, onQuickGenerate, shake, disabled }) {
  const inputRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !disabled) onGenerate();
  }

  return (
    <div className="space-y-4">
      <div className={shake ? 'animate-shake' : ''}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter an academic topic or field..."
          disabled={disabled}
          className="w-full px-4 py-3.5 text-base border border-stone-300 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 transition-colors disabled:bg-stone-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map(example => (
          <button
            key={example}
            onClick={() => onChange(example)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 transition-colors disabled:opacity-40 bg-white"
          >
            {example}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onGenerate}
          disabled={disabled}
          className="px-6 py-2.5 bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disabled ? 'Generating...' : 'Explore'}
        </button>
      </div>
    </div>
  );
}

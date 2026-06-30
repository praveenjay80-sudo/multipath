import { useState } from 'react';

const STORAGE_KEY = 'canon_history';
const MAX_HISTORY = 50;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function useCanonHistory() {
  const [history, setHistory] = useState(loadHistory);

  function persist(items) {
    setHistory(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function saveCanon(topic, content, passType = 'full') {
    const newItem = {
      id: crypto.randomUUID(),
      topic,
      content,
      passType,
      generatedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...history].slice(0, MAX_HISTORY);
    persist(updated);
    return newItem;
  }

  function deleteCanon(id) {
    persist(history.filter(h => h.id !== id));
  }

  function clearAll() {
    persist([]);
  }

  return { history, saveCanon, deleteCanon, clearAll };
}

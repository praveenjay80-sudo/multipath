import { resolveAnthropicApiKey } from './claudeRelevance';

export const EXPLAIN_SYSTEM = `You explain scientific concepts to complete beginners — people with no maths, no science, no jargon.

Write in exactly this structure, using the section labels as written:

ANALOGY
One vivid, concrete everyday comparison from something anyone has experienced. Make it specific and surprising.

WHAT IT IS
Two short paragraphs in plain language. No equations. Build the idea from the analogy, step by step.

REAL-LIFE EXAMPLES
Three specific, named examples of where this concept appears in the real world — technologies, products, natural phenomena, everyday situations.
• [Example 1]
• [Example 2]
• [Example 3]

WHY IT MATTERS
One sentence on why this concept is important or useful.`;

export const EXPLAIN_HEADERS = new Set(['ANALOGY', 'WHAT IT IS', 'REAL-LIFE EXAMPLES', 'WHY IT MATTERS']);

export { resolveAnthropicApiKey };

export async function streamExplanation(concept, apiKey, signal, onChunk) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      stream: true,
      system: EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: `Explain "${concept}" to a complete beginner.` }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            text += ev.delta.text;
            onChunk(text);
          }
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
  return text;
}

export function scholarUrl(query) {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
}

export function googleBooksUrl(query) {
  return `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(query)}`;
}

export default function WorkSourceLink({ title, isPaper = false }) {
  if (!title) return null;
  const scholar = scholarUrl(title);
  const books = googleBooksUrl(title);
  return (
    <span className="inline-flex items-center gap-1.5 ml-1">
      <a
        href={isPaper ? scholar : books}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-stone-300 hover:text-stone-600 transition-colors font-mono"
        title={isPaper ? 'Google Scholar' : 'Google Books'}
      >
        {isPaper ? 'Scholar' : 'Books'}
      </a>
      {!isPaper && (
        <a
          href={scholar}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-stone-300 hover:text-stone-600 transition-colors font-mono"
          title="Google Scholar"
        >
          Scholar
        </a>
      )}
    </span>
  );
}

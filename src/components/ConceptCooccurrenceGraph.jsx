// Simple SVG force-directed graph showing concept ↔ work relationships
// for the current topic. Uses d3-force-like physics in a small loop.

import { useEffect, useRef, useState } from 'react';

const NODE_RADIUS = { concept: 14, work: 9, author: 10 };
const NODE_COLORS = {
  concept: '#8b5cf6', // violet
  work: '#10b981',    // emerald
  author: '#6366f1',  // indigo
};

export default function ConceptCooccurrenceGraph({
  concepts = [],
  works = [],
  authors = [],
  onNodeClick,
  width = 600,
  height = 400,
}) {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);

  // Build graph: concepts as hubs, works as bridges, authors as endpoints
  useEffect(() => {
    const n = [];
    const l = [];

    // Concept nodes
    const conceptIds = new Map();
    concepts.slice(0, 12).forEach((c, i) => {
      const id = `c-${i}`;
      n.push({
        id,
        type: 'concept',
        label: c.name,
        x: width / 2 + (Math.cos((i / concepts.length) * Math.PI * 2) * (width * 0.35)),
        y: height / 2 + (Math.sin((i / concepts.length) * Math.PI * 2) * (height * 0.35)),
        vx: 0, vy: 0,
      });
      conceptIds.set(c.name, id);
    });

    // Work nodes (max 16)
    const workIds = new Map();
    works.slice(0, 16).forEach((w, i) => {
      const id = `w-${i}`;
      const shortTitle = w.title.length > 32 ? w.title.slice(0, 30) + '…' : w.title;
      n.push({
        id,
        type: 'work',
        label: shortTitle,
        x: width / 2 + (Math.random() - 0.5) * width * 0.6,
        y: height / 2 + (Math.random() - 0.5) * height * 0.6,
        vx: 0, vy: 0,
      });
      workIds.set(w.title, id);
    });

    // Author nodes (max 10)
    const authorIds = new Map();
    authors.slice(0, 10).forEach((a, i) => {
      const id = `a-${i}`;
      n.push({
        id,
        type: 'author',
        label: a,
        x: width / 2 + (Math.random() - 0.5) * width * 0.7,
        y: height / 2 + (Math.random() - 0.5) * height * 0.7,
        vx: 0, vy: 0,
      });
      authorIds.set(a, id);
    });

    // Edges: concept → work
    for (const c of concepts.slice(0, 12)) {
      const cId = conceptIds.get(c.name);
      for (const w of works.slice(0, 16)) {
        if ((w.title || '').toLowerCase().includes(c.name.toLowerCase()) ||
            (w.allAuthors || '').toLowerCase().includes(c.name.toLowerCase())) {
          const wId = workIds.get(w.title);
          if (wId) l.push({ source: cId, target: wId, strength: 0.3 });
        }
      }
    }

    // Edges: work → author (first author)
    for (const w of works.slice(0, 16)) {
      const wId = workIds.get(w.title);
      const firstAuthor = (w.firstAuthor || w.allAuthors?.split(',')[0])?.trim();
      if (firstAuthor) {
        const aId = authorIds.get(firstAuthor);
        if (aId) l.push({ source: wId, target: aId, strength: 0.6 });
      }
    }

    setNodes(n);
    setLinks(l);
  }, [concepts, works, authors, width, height]);

  // Simple force simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    const sim = {
      alpha: 1,
      alphaDecay: 0.02,
      tick: 0,
    };

    const interval = setInterval(() => {
      if (sim.alpha < 0.005) {
        clearInterval(interval);
        return;
      }
      sim.alpha -= sim.alphaDecay;
      sim.tick++;

      setNodes(prev => {
        const next = prev.map(n => ({ ...n }));
        const idx = new Map(next.map((n, i) => [n.id, i]));

        // Repulsion between all nodes
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i];
            const b = next[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d2 = dx * dx + dy * dy + 0.01;
            const d = Math.sqrt(d2);
            const force = (80 * sim.alpha) / d2;
            const fx = (dx / d) * force;
            const fy = (dy / d) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }

        // Attraction along links
        for (const l of links) {
          const a = next[idx.get(l.source)];
          const b = next[idx.get(l.target)];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy + 0.01) || 0.01;
          const ideal = 90;
          const force = (d - ideal) * 0.04 * (l.strength || 0.5);
          a.vx += (dx / d) * force;
          a.vy += (dy / d) * force;
          b.vx -= (dx / d) * force;
          b.vy -= (dy / d) * force;
        }

        // Centering
        for (const n of next) {
          n.vx += (width / 2 - n.x) * 0.01;
          n.vy += (height / 2 - n.y) * 0.01;
          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;
          // Keep within bounds
          n.x = Math.max(20, Math.min(width - 20, n.x));
          n.y = Math.max(20, Math.min(height - 20, n.y));
        }
        return next;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [nodes.length, links, width, height]);

  if (concepts.length === 0 && works.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 text-sm">
        No entities to visualize yet
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="bg-stone-50 border border-stone-200"
      >
        {/* Edges */}
        {links.map((l, i) => {
          const a = nodes.find(n => n.id === l.source);
          const b = nodes.find(n => n.id === l.target);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#a8a29e"
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            className="cursor-pointer"
            onClick={() => onNodeClick?.(n)}
          >
            <circle
              r={NODE_RADIUS[n.type] || 8}
              fill={NODE_COLORS[n.type] || '#737373'}
              fillOpacity={0.85}
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={0}
              y={(NODE_RADIUS[n.type] || 8) + 11}
              textAnchor="middle"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
              fill="#44403c"
              style={{ pointerEvents: 'none' }}
            >
              {n.label.length > 24 ? n.label.slice(0, 22) + '…' : n.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-stone-500">
        <Legend color={NODE_COLORS.concept} label={`Concepts (${concepts.length})`} />
        <Legend color={NODE_COLORS.work} label={`Works (${works.length})`} />
        <Legend color={NODE_COLORS.author} label={`Authors (${authors.length})`} />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

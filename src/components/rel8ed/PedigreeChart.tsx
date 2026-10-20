import React from 'react';

import type { Rel8edPedigreeNode } from '../../types/rel8ed';

type Props = {
  root: Rel8edPedigreeNode | null;
  onSelect?: (id: number) => void;
};

function NodeCard({
  node,
  onSelect,
}: {
  node: Rel8edPedigreeNode;
  onSelect?: (id: number) => void;
}) {
  return (
    <button
      type="button"
      className="rel8ed-node"
      onClick={() => onSelect?.(node.id)}
      title={`Ahnentafel ${node.ahnentafel ?? ''}`}
    >
      <strong>{node.name}</strong>
      <span>
        {[node.birth, node.death].filter(Boolean).join(' – ') || '—'}
      </span>
      {Number(node.has_sources) === 1 ? <em className="rel8ed-badge sourced">sourced</em> : <em className="rel8ed-badge unsourced">unsourced</em>}
    </button>
  );
}

function Branch({
  node,
  onSelect,
}: {
  node: Rel8edPedigreeNode;
  onSelect?: (id: number) => void;
}) {
  return (
    <div className="rel8ed-branch">
      <NodeCard node={node} onSelect={onSelect} />
      {(node.father || node.mother) ? (
        <div className="rel8ed-parents">
          {node.father ? <Branch node={node.father} onSelect={onSelect} /> : <div className="rel8ed-node empty">Father unknown</div>}
          {node.mother ? <Branch node={node.mother} onSelect={onSelect} /> : <div className="rel8ed-node empty">Mother unknown</div>}
        </div>
      ) : null}
    </div>
  );
}

export function PedigreeChart({ root, onSelect }: Props) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  if (!root) {
    return <div className="rel8ed-empty">No pedigree yet. Import a GEDCOM or add people.</div>;
  }

  return (
    <div className="rel8ed-chart-tools">
      <div className="rel8ed-zoom">
        <button type="button" onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}>Zoom in</button>
        <button type="button" onClick={() => setScale((s) => Math.max(0.4, s - 0.1))}>Zoom out</button>
        <button type="button" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>Reset</button>
      </div>
      <div
        className="rel8ed-chart-viewport"
        ref={viewportRef}
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) => Math.max(0.4, Math.min(2.5, s + (e.deltaY < 0 ? 0.05 : -0.05))));
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({
            x: drag.current.ox + (e.clientX - drag.current.x),
            y: drag.current.oy + (e.clientY - drag.current.y),
          });
        }}
        onPointerUp={() => { drag.current = null; }}
      >
        <div
          className="rel8ed-pedigree"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          <Branch node={root} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}

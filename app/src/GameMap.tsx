import { defenseOf, type GameState, type IslandId, type PlayerOrders } from '@island/engine';
import { useMemo, useState } from 'react';
import { playerColor } from './format';
import { normalize, type TargetKind } from './orders';

const SIZE = 30;
const SQRT3 = Math.sqrt(3);

function toPixel(q: number, r: number) {
  return { x: SIZE * SQRT3 * (q + r / 2), y: SIZE * 1.5 * r };
}

function hexPoints(cx: number, cy: number, s: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + s * Math.cos(a)).toFixed(1)},${(cy + s * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

interface Props {
  state: GameState;
  selected: IslandId | null;
  targets: Map<IslandId, TargetKind> | null;
  orders: PlayerOrders;
  onTap: (id: IslandId) => void;
}

export function GameMap({ state, selected, targets, orders, onTap }: Props) {
  const [zoom, setZoom] = useState(1);
  const islands = Object.values(state.islands);

  const box = useMemo(() => {
    const pts = islands.map((i) => toPixel(i.q, i.r));
    const minX = Math.min(...pts.map((p) => p.x)) - SIZE * 1.2;
    const maxX = Math.max(...pts.map((p) => p.x)) + SIZE * 1.2;
    const minY = Math.min(...pts.map((p) => p.y)) - SIZE * 1.2;
    const maxY = Math.max(...pts.map((p) => p.y)) + SIZE * 1.2;
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }, [islands]);

  const o = normalize(orders);
  const arrows = [
    ...o.attacks.map((a) => ({ from: a.from, to: a.to, kind: 'attack' as const })),
    ...o.moves.map((m) => ({ from: m.from, to: m.to, kind: 'move' as const })),
  ];

  return (
    <div className="map-wrap">
      <div className="map-scroll">
        <svg
          className="map"
          viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
          style={{ width: `${zoom * 100}%`, aspectRatio: `${box.w} / ${box.h}` }}
          role="img"
          aria-label="Carte des îles"
        >
          <defs>
            <marker id="arrow-attack" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#ff4d4d" />
            </marker>
            <marker id="arrow-move" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#7dffa1" />
            </marker>
          </defs>

          {islands.map((i) => {
            const { x, y } = toPixel(i.q, i.r);
            const target = targets?.get(i.id);
            const isSel = selected === i.id;
            const color = playerColor(state, i.owner);
            return (
              <g key={i.id} className={`island ${i.remote ? 'island-remote' : ''}`} onClick={() => onTap(i.id)}>
                <polygon points={hexPoints(x, y, SIZE * 0.98)} className={`hex ${target ? `hex-${target}` : ''} ${i.remote ? 'hex-far' : i.hidden ? 'hex-fog' : ''}`} />
                <circle cx={x} cy={y} r={SIZE * 0.62} fill="#e7cf8f" />
                <circle
                  cx={x}
                  cy={y}
                  r={SIZE * 0.5}
                  fill={i.owner ? color : '#6c9a5a'}
                  stroke={isSel ? '#fff' : i.isCapital ? '#222' : 'none'}
                  strokeWidth={isSel ? 4 : 2.5}
                />
                {i.isCapital && <text x={x} y={y - SIZE * 0.68} className="crown">♛</text>}
                {!i.remote && <text x={x} y={y + 5} className="soldiers">{i.hidden ? '?' : i.soldiers}</text>}
                {!i.remote && <text x={x} y={y + SIZE * 0.9} className="defense">🛡{i.hidden ? '?' : defenseOf(i)}</text>}
                {i.woodSymbol && <circle cx={x - SIZE * 0.55} cy={y - SIZE * 0.4} r={5} fill="#8b5a2b" stroke="#fff" strokeWidth={1.5} />}
                {i.goldSymbol && <circle cx={x + SIZE * 0.55} cy={y - SIZE * 0.4} r={5} fill="#ffd23f" stroke="#fff" strokeWidth={1.5} />}
                {i.buildings.length > 0 && (
                  <rect x={x + SIZE * 0.38} y={y + SIZE * 0.25} width={9} height={9} rx={2} fill="#eee" stroke="#333" strokeWidth={1} />
                )}
              </g>
            );
          })}

          {arrows.map((a, idx) => {
            const f = state.islands[a.from];
            const t = state.islands[a.to];
            if (!f || !t) return null;
            const p1 = toPixel(f.q, f.r);
            const p2 = toPixel(t.q, t.r);
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const k = (SIZE * 0.6) / len;
            return (
              <line
                key={idx}
                x1={p1.x + dx * k}
                y1={p1.y + dy * k}
                x2={p2.x - dx * k}
                y2={p2.y - dy * k}
                className={`arrow arrow-${a.kind}`}
                markerEnd={`url(#arrow-${a.kind})`}
              />
            );
          })}
        </svg>
      </div>
      <div className="zoom">
        <button onClick={() => setZoom((z) => Math.min(4, z * 1.4))} aria-label="Zoomer">＋</button>
        <button onClick={() => setZoom((z) => Math.max(1, z / 1.4))} aria-label="Dézoomer">－</button>
      </div>
    </div>
  );
}

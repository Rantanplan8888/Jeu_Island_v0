import { defenseOf, type BuildingType, type GameState, type IslandId, type PlayerId, type PlayerOrders } from '@island/engine';
import { useMemo, useState, type ReactNode } from 'react';
import { playerColor } from './format';
import { normalize, type TargetKind } from './orders';

const SIZE = 30;

/** Icône de chaque bâtiment, dessinée sur l'île. */
export const BUILDING_ICONS: Record<BuildingType, string> = {
  mine: '⛏️',
  sawmill: '🪓',
  barracks: '⛺',
  port: '⚓',
  tower: '🏰',
  university: '🎓',
};

/** Emplacements des icônes de bâtiments autour de l'île (en bas, puis sur les côtés). */
const BUILDING_SLOTS = [
  [-0.62, 0.52], [0.62, 0.52], [-0.82, 0.08], [-0.3, 0.78], [0.3, 0.78], [0.82, 0.08],
] as const;
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
  /** Joueur qui regarde la carte : ses ordres en attente sont affichés sur ses îles. */
  pid?: PlayerId;
  onTap: (id: IslandId) => void;
  /** Encart posé dans le coin haut gauche de la carte (bilan des ressources). */
  corner?: ReactNode;
}

export function GameMap({ state, selected, targets, orders, pid, onTap, corner }: Props) {
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
    ...o.attacks.map((a) => ({ from: a.from, to: a.to, kind: 'attack' as const, soldiers: a.soldiers, mercs: a.mercenaries })),
    ...o.moves.map((m) => ({ from: m.from, to: m.to, kind: 'move' as const, soldiers: m.soldiers, mercs: 0 })),
  ];
  // Soldats qui arrivent (recrues) ou partent (attaques, déplacements) de chaque île, d'après mes ordres.
  const delta = new Map<IslandId, { plus: number; minus: number }>();
  const bump = (id: IslandId, plus: number, minus: number) => {
    const d = delta.get(id) ?? { plus: 0, minus: 0 };
    delta.set(id, { plus: d.plus + plus, minus: d.minus + minus });
  };
  for (const r of o.recruits) bump(r.islandId, r.soldiers, 0);
  for (const a of arrows) if (a.soldiers) bump(a.from, 0, a.soldiers);
  const planned = new Map<IslandId, BuildingType[]>();
  for (const b of o.builds) planned.set(b.islandId, [...(planned.get(b.islandId) ?? []), b.building]);

  return (
    <div className="map-wrap">
      {corner}
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
                {[
                  ...i.buildings.map((b) => ({ type: b.type, planned: false })),
                  ...(i.owner === pid ? planned.get(i.id) ?? [] : []).map((type) => ({ type, planned: true })),
                ].slice(0, BUILDING_SLOTS.length).map((b, k) => {
                  const [dx, dy] = BUILDING_SLOTS[k]!;
                  return (
                    <text key={k} x={x + SIZE * dx} y={y + SIZE * dy + 4} className={`bicon ${b.planned ? 'bicon-planned' : ''}`}>
                      {BUILDING_ICONS[b.type]}
                    </text>
                  );
                })}
              </g>
            );
          })}

          {/* Soldats en plus (recrues) et en moins (départs) d'après mes ordres, dessinés par-dessus les îles. */}
          {pid && [...delta].map(([id, d]) => {
            const i = state.islands[id];
            if (!i || i.owner !== pid) return null;
            const { x, y } = toPixel(i.q, i.r);
            // « →0 » : soldats qui resteront sur l'île après mes ordres (recrues comprises, départs déduits).
            const label = `→${i.soldiers + d.plus - d.minus}`;
            const w = 6 + label.length * 5.5;
            const cy = y - SIZE * 0.66;
            return (
              <g key={`d${id}`} className="troop-delta">
                <rect x={x - w / 2} y={cy - 7} width={w} height={13} rx={6.5} />
                <text x={x} y={cy + 3.5}>{label}</text>
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
            // Cible à 2 cases en ligne droite : la flèche se courbe pour contourner la case du milieu.
            const aligned = (f.q + t.q) % 2 === 0 && (f.r + t.r) % 2 === 0;
            const bend = aligned && len > SIZE * 2.2 ? SIZE * 1.5 : 0;
            const c = { x: (p1.x + p2.x) / 2 - (dy / len) * bend, y: (p1.y + p2.y) / 2 + (dx / len) * bend };
            const toward = (from: { x: number; y: number }, to: { x: number; y: number }, d: number) => {
              const l = Math.hypot(to.x - from.x, to.y - from.y) || 1;
              return { x: from.x + ((to.x - from.x) / l) * d, y: from.y + ((to.y - from.y) / l) * d };
            };
            const start = toward(p1, c, SIZE * 0.6);
            const end = toward(p2, c, SIZE * 0.6);
            // Soldats en blanc, mercenaires en or : « ⚔4+2M » (M en or).
            const main = `${a.kind === 'attack' ? '⚔' : ''}${a.soldiers}`;
            const merc = a.mercs ? `+${a.mercs}M` : '';
            const w = 8 + (main.length + merc.length) * 5.6;
            // Étiquette sur la flèche : au milieu entre deux voisines, vers la pointe pour une flèche courbée.
            const tl = bend ? 0.72 : 0.5;
            const mx = (1 - tl) ** 2 * start.x + 2 * tl * (1 - tl) * c.x + tl ** 2 * end.x;
            const my = (1 - tl) ** 2 * start.y + 2 * tl * (1 - tl) * c.y + tl ** 2 * end.y;
            return (
              <g key={idx}>
                <path
                  d={`M${start.x.toFixed(1)},${start.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`}
                  fill="none"
                  className={`arrow arrow-${a.kind}`}
                  markerEnd={`url(#arrow-${a.kind})`}
                />
                <g className={`arrow-label arrow-label-${a.kind}`}>
                  <rect x={mx - w / 2} y={my - 7} width={w} height={14} rx={7} />
                  <text x={mx} y={my + 3.5}>{main}{merc && <tspan className="merc">{merc}</tspan>}</text>
                </g>
              </g>
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

/**
 * Comparaison de variantes de règles : chaque variante joue le même tournoi mixte.
 *
 *   node --experimental-strip-types sim/sweep.ts [parties par variante] [filtre]
 *
 * Les variantes tournent en parallèle (un fil par cœur) et le résultat est écrit
 * dans sim/resultats.json pour le rapport.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { writeFileSync } from 'node:fs';
import { makeRules, type Rules } from '../engine/src/index.ts';
import { summarize, tournament, printSummary, type Summary } from './run.ts';

const OLD: Partial<Rules> = { fog: null, incomeDecay: null, occupationRequiresSoldier: false, mercenariesPerSoldier: null, attackerTieBreak: 'playerId' };

export const VARIANTS: { name: string; label: string; rules: Partial<Rules> }[] = [
  { name: 'anciennes', label: 'Anciennes règles (avant équilibrage)', rules: OLD },
  { name: 'sans-brouillard', label: 'Règles actuelles sans brouillard', rules: { fog: null } },
  { name: 'actuel', label: 'Règles par défaut (brouillard 1 / 2 cases)', rules: {} },
  { name: 'brouillard-2-3', label: 'Brouillard plus large (2 / 3 cases)', rules: { fog: { fullRange: 2, partialRange: 3 } } },
  { name: 'brouillard-0-1', label: 'Brouillard serré (seulement ses îles / 1 case)', rules: { fog: { fullRange: 0, partialRange: 1 } } },
];




interface Job { name: string; rules: Partial<Rules>; games: number }

if (!isMainThread) {
  const job = workerData as Job;
  const rules = makeRules(job.rules);
  // Mêmes cartes et mêmes tirages de stratégies pour toutes les variantes.
  const recs = tournament(job.games, rules);
  parentPort!.postMessage(summarize(recs));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2] ?? 400);
  const filter = process.argv[3];
  const variants = VARIANTS.filter((v) => !filter || v.name.includes(filter));
  const results: Record<string, Summary> = {};
  const queue = [...variants];
  const workers = Math.min(availableParallelism(), variants.length);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, async () => {
    for (let v = queue.shift(); v; v = queue.shift()) {
      const job: Job = { name: v.name, rules: v.rules, games };
      results[v.name] = await new Promise<Summary>((resolve, reject) => {
        const w = new Worker(new URL(import.meta.url), { workerData: job, execArgv: ['--experimental-strip-types', '--no-warnings'] });
        w.once('message', resolve);
        w.once('error', reject);
      });
    }
  }));
  for (const v of variants) printSummary(v.label, results[v.name]!);
  writeFileSync(new URL('./resultats.json', import.meta.url), JSON.stringify({ games, variants: variants.map((v) => ({ ...v, summary: results[v.name] })) }, null, 2));
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

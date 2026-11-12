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

const OLD: Partial<Rules> = { incomeDecay: null, occupationRequiresSoldier: false, mercenariesPerSoldier: null, attackerTieBreak: 'playerId' };

export const VARIANTS: { name: string; label: string; rules: Partial<Rules> }[] = [
  { name: 'anciennes', label: 'Anciennes règles (avant équilibrage)', rules: OLD },
  { name: 'sans-decr', label: 'Règles validées sans revenus décroissants', rules: { incomeDecay: null } },
  { name: 'actuel', label: 'Règles par défaut (avec revenus décroissants)', rules: {} },
  { name: 'decr-6-5', label: 'Revenus décroissants : dès 6 îles, 5 % par île', rules: { incomeDecay: { threshold: 6, rate: 0.05 } } },
  { name: 'decr-6-10', label: 'Revenus décroissants : dès 6 îles, 10 % par île', rules: { incomeDecay: { threshold: 6, rate: 0.1 } } },
  { name: 'decr-8-10', label: 'Revenus décroissants : dès 8 îles, 10 % par île', rules: { incomeDecay: { threshold: 8, rate: 0.1 } } },
  { name: 'decr-6-20', label: 'Revenus décroissants : dès 6 îles, 20 % par île', rules: { incomeDecay: { threshold: 6, rate: 0.2 } } },
  { name: 'decr-4-30', label: 'Revenus décroissants : dès 4 îles, 30 % par île', rules: { incomeDecay: { threshold: 4, rate: 0.3 } } },
  { name: 'decr-6-15', label: 'Revenus décroissants : dès 6 îles, 15 % par île', rules: { incomeDecay: { threshold: 6, rate: 0.15 } } },
  { name: 'decr-5-25', label: 'Revenus décroissants : dès 5 îles, 25 % par île', rules: { incomeDecay: { threshold: 5, rate: 0.25 } } },
  { name: 'decr-6-30', label: 'Revenus décroissants : dès 6 îles, 30 % par île', rules: { incomeDecay: { threshold: 6, rate: 0.3 } } },
  { name: 'decr-6-10+tour5', label: 'Décroissance 6/10 % + tour à +5', rules: { incomeDecay: { threshold: 6, rate: 0.1 }, towerDefense: 5 } },
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

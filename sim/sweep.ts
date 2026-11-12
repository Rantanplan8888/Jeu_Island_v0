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

const OLD: Partial<Rules> = { occupationRequiresSoldier: false, mercenariesPerSoldier: null, attackerTieBreak: 'playerId' };
const B = makeRules().buildings;

export const VARIANTS: { name: string; label: string; rules: Partial<Rules> }[] = [
  { name: 'anciennes', label: 'Anciennes règles (avant équilibrage)', rules: OLD },
  { name: 'actuel', label: 'Règles équilibrées (par défaut)', rules: {} },
  { name: 'merc3or', label: 'Mercenaire à 3 or', rules: { mercenaryCost: { gold: 3, wood: 0 } } },
  { name: 'merc-demi', label: '1 mercenaire pour 2 soldats', rules: { mercenariesPerSoldier: 0.5 } },
  { name: 'mine1', label: 'Mine à +1 or', rules: { mineGold: 1 } },
  { name: 'neutres+2', label: 'Îles neutres plus fortes (+2)', rules: { plainDefenses: [4, 5, 6], bonusDefenses: [7, 8], bothDefenses: [10, 11, 12], buildingDefenses: [6, 7, 8] } },
  { name: 'mur5', label: 'Mur de capitale à 5', rules: { capitalWallDefense: 5 } },
  { name: 'tour5', label: 'Tour à +5', rules: { towerDefense: 5 } },
  { name: 'tour2bois', label: 'Tour à 2 bois', rules: { buildings: { ...B, tower: { cost: { gold: 0, wood: 2 }, label: 'Tour' } } } },
  { name: 'depart5', label: '5 soldats au départ', rules: { startingSoldiers: 5 } },
  { name: 'revenu-ile2', label: 'Symbole à +2 au lieu de +3', rules: { symbolIncome: 2 } },
  { name: 'secondaire0', label: 'Attaquants secondaires sans effet', rules: { secondaryForceShare: 0 } },
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

/**
 * Outil d'administration ponctuel : « rébellion » dans une partie en cours.
 * Les armées d'un joueur rallient un autre joueur avec toutes leurs îles sauf une (leur capitale si possible),
 * et une annonce est ajoutée au rapport du dernier tour et au prochain rapport.
 *
 * Lancé par le workflow « Admin : rébellion » (GitHub Actions, déclenchement manuel) avec la clé serveur.
 * Variables : SUPABASE_URL, SERVICE_KEY, PARTIE (nom exact), RALLIEMENTS (« bleu>vert,jaune>orange »),
 *             MESSAGE (facultatif, remplace l'annonce par défaut), IMAGE (facultatif, ex. /annonces/rebellion.jpg),
 *             DRY_RUN (« true » = n'écrit rien).
 * Sans RALLIEMENTS : remplace seulement l'annonce (en attente et dans le dernier rapport) par MESSAGE + IMAGE.
 */

const { SUPABASE_URL, SERVICE_KEY, PARTIE, RALLIEMENTS, MESSAGE = '', IMAGE = '', DRY_RUN = 'true' } = process.env;
if (IMAGE && !/^\/annonces\/[\w-]+\.(jpg|png|webp)$/.test(IMAGE)) { console.error('❌ IMAGE doit ressembler à /annonces/nom.jpg'); process.exit(1); }
const dryRun = DRY_RUN !== 'false';

// Mêmes couleurs que l'appli (app/src/format.ts), dans le même ordre.
const PALETTE = [
  ['#e4572e', 'orange'], ['#4c8bf5', 'bleu'], ['#f2c14e', 'jaune'], ['#8e44ad', 'violet'], ['#2ecc71', 'vert'],
  ['#ff7eb6', 'rose'], ['#1abc9c', 'turquoise'], ['#f39c12', 'orange clair'], ['#c0392b', 'rouge'], ['#7f8c8d', 'gris'],
];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) fail(`${init.method ?? 'GET'} ${path.split('?')[0]} : ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

if (!SUPABASE_URL || !SERVICE_KEY) fail('SUPABASE_URL ou SERVICE_KEY manquant.');
if (!PARTIE) fail('Nom de partie manquant.');

const games = await rest(`games?name=eq.${encodeURIComponent(PARTIE)}&status=eq.running&select=id,name,turn,state`);
if (games.length !== 1) {
  const all = await rest('games?status=eq.running&select=name,turn');
  fail(`${games.length} partie(s) en cours nommée(s) « ${PARTIE} ». Parties en cours : ${all.map((g) => `« ${g.name} » (tour ${g.turn})`).join(', ') || 'aucune'}.`);
}
const game = games[0];
const state = game.state;
const ids = Object.keys(state.players).sort();
const colorOf = (pid) => PALETTE[ids.indexOf(pid) % PALETTE.length];
const count = (pid) => Object.values(state.islands).filter((i) => i.owner === pid).length;

console.log(`Partie « ${game.name} », tour ${game.turn}. Joueurs :`);
for (const pid of ids) {
  const p = state.players[pid];
  const [hex, nom] = colorOf(pid);
  console.log(`  - ${nom} (${hex}) : ${p.name}, ${count(pid)} île(s)${p.eliminated ? ', éliminé(e)' : ''}`);
}

const byColor = (nom) => {
  const found = ids.filter((pid) => colorOf(pid)[1] === nom.trim().toLowerCase());
  if (found.length !== 1) fail(`Couleur « ${nom} » : ${found.length} joueur(s) correspondant(s).`);
  return found[0];
};
// Mode « annonce seulement » : on remplace le texte (et l'image) de l'annonce, sans toucher à la carte.
if (!(RALLIEMENTS ?? '').trim()) {
  if (!MESSAGE.trim()) fail('Sans ralliement, il faut un MESSAGE.');
  const ann = IMAGE ? { text: MESSAGE.trim(), image: IMAGE } : { text: MESSAGE.trim() };
  console.log(`Nouvelle annonce${IMAGE ? ` (image ${IMAGE})` : ''} :\n  📣 ${ann.text}`);
  if (dryRun) { console.log('Essai à blanc (dry run) : rien n\'a été modifié.'); process.exit(0); }
  state.announcements = [ann];
  const up = await rest(`games?id=eq.${game.id}&turn=eq.${game.turn}&status=eq.running`, { method: 'PATCH', body: JSON.stringify({ state }) });
  if (!up.length) fail('Le tour a changé pendant l\'opération : relance le workflow.');
  console.log('✓ Annonce du prochain rapport remplacée.');
  const lastTurn = game.turn - 1;
  const reports = lastTurn >= 1 ? await rest(`turn_reports?game_id=eq.${game.id}&turn=eq.${lastTurn}&select=events`) : [];
  if (reports.length === 1) {
    const events = [{ kind: 'announcement', ...ann }, ...(reports[0].events ?? []).filter((e) => e.kind !== 'announcement')];
    await rest(`turn_reports?game_id=eq.${game.id}&turn=eq.${lastTurn}`, { method: 'PATCH', body: JSON.stringify({ events }) });
    console.log(`✓ Annonce du rapport du tour ${lastTurn} remplacée.`);
  }
  process.exit(0);
}

const rallies = (RALLIEMENTS ?? '').split(',').filter((s) => s.trim()).map((pair) => {
  const [from, to] = pair.split('>');
  if (!from || !to) fail(`Ralliement mal écrit : « ${pair} » (attendu : couleur>couleur).`);
  const rebel = byColor(from);
  const ally = byColor(to);
  if (rebel === ally) fail('Un joueur ne peut pas se rallier à lui-même.');
  if (state.players[rebel].eliminated || state.players[ally].eliminated) fail('Joueur éliminé dans un ralliement.');
  return { rebel, ally };
});
if (rallies.length === 0) fail('Aucun ralliement.');

const lines = [];
for (const { rebel, ally } of rallies) {
  const own = Object.values(state.islands).filter((i) => i.owner === rebel);
  if (own.length < 2) fail(`${state.players[rebel].name} n'a que ${own.length} île : rien à céder.`);
  // On garde une base : la capitale actuelle, sinon une capitale de départ, sinon l'île la mieux défendue.
  const kept =
    own.find((i) => i.isCapital) ?? own.find((i) => i.startingCapital) ?? own.slice().sort((a, b) => b.soldiers - a.soldiers)[0];
  let soldiers = 0;
  for (const island of own) {
    if (island.id === kept.id) continue;
    island.owner = ally;
    island.isCapital = false;
    soldiers += island.soldiers;
  }
  const rebelName = state.players[rebel].name;
  const allyName = state.players[ally].name;
  console.log(`→ ${rebelName} cède ${own.length - 1} île(s) et ${soldiers} soldat(s) à ${allyName}, et garde ${kept.id} (${kept.soldiers} soldat(s)).`);
  lines.push(
    `🪧 RÉBELLION ! Jamais payées, mal nourries, oubliées sur leurs îles, les armées de ${rebelName} se mettent en grève générale ` +
      `et rallient ${allyName} avec ${own.length - 1} île(s) et ${soldiers} soldat(s). « Qu'est-ce qu'on est bien chez ${allyName} ! » ` +
      `Il ne reste à ${rebelName} qu'une seule île, et quelques fidèles.`,
  );
}
const announcements = (MESSAGE.trim() ? [MESSAGE.trim()] : lines).map((text, i) => (IMAGE && i === 0 ? { text, image: IMAGE } : text));
console.log('Annonce :');
for (const a of announcements) console.log(`  📣 ${typeof a === 'string' ? a : `${a.text} [${a.image}]`}`);

if (dryRun) {
  console.log('Essai à blanc (dry run) : rien n\'a été modifié.');
  process.exit(0);
}

state.announcements = [...(state.announcements ?? []), ...announcements];
const updated = await rest(`games?id=eq.${game.id}&turn=eq.${game.turn}&status=eq.running`, {
  method: 'PATCH',
  body: JSON.stringify({ state }),
});
if (!updated.length) fail('Le tour a changé pendant l\'opération : relance le workflow.');
console.log('✓ Carte modifiée. L\'annonce paraîtra dans le prochain rapport.');

// Et tout de suite dans le rapport du dernier tour, pour que ceux qui l'ouvrent comprennent la nouvelle carte.
const lastTurn = game.turn - 1;
if (lastTurn >= 1) {
  const reports = await rest(`turn_reports?game_id=eq.${game.id}&turn=eq.${lastTurn}&select=events`);
  if (reports.length === 1) {
    const events = [...announcements.map((a) => ({ kind: 'announcement', ...(typeof a === 'string' ? { text: a } : a) })), ...(reports[0].events ?? [])];
    await rest(`turn_reports?game_id=eq.${game.id}&turn=eq.${lastTurn}`, { method: 'PATCH', body: JSON.stringify({ events }) });
    console.log(`✓ Annonce ajoutée au rapport du tour ${lastTurn}.`);
  }
}

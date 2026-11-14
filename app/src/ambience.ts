/**
 * Ambiance sonore générée sur place (aucun fichier, aucune connexion) : houle filtrée et quelques notes de violoncelle.
 * Coupée par défaut ; le son est suspendu dès que l'appli n'est plus à l'écran, pour ménager la batterie.
 */

const PREF_KEY = 'island.sound';
// Gamme pentatonique de ré majeur dans le registre du violoncelle : rien ne sonne faux, quel que soit l'ordre.
const NOTES = [73.42, 92.5, 110.0, 123.47, 146.83, 164.81, 185.0, 220.0, 246.94, 293.66];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let echo: GainNode | null = null;
let noteTimer: ReturnType<typeof setTimeout> | null = null;
let playing = false;
const listeners = new Set<(on: boolean) => void>();

export function soundWanted(): boolean {
  try { return localStorage.getItem(PREF_KEY) === 'on'; } catch { return false; }
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  // Bruit « brun » : plus grave et plus doux que le bruit blanc, proche du ressac.
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

/** Une couche de vagues : bruit filtré dont le volume monte et descend lentement. */
function waveLayer(c: AudioContext, out: AudioNode, buf: AudioBuffer, cutoff: number, period: number, level: number) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = c.createGain();
  gain.gain.value = level;
  const lfo = c.createOscillator();
  lfo.frequency.value = 1 / period;
  const depth = c.createGain();
  depth.gain.value = level * 0.9;
  lfo.connect(depth).connect(gain.gain);
  src.connect(filter).connect(gain).connect(out);
  src.start(c.currentTime + Math.random() * 2);
  lfo.start();
}

function build() {
  const c = new AudioContext();
  ctx = c;
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  const buf = noiseBuffer(c, 4);
  waveLayer(c, master, buf, 420, 9, 0.35);
  waveLayer(c, master, buf, 900, 13, 0.12);

  // Écho léger pour les notes (un peu d'espace, comme sur l'eau).
  const delay = c.createDelay(2);
  delay.delayTime.value = 0.45;
  const feedback = c.createGain();
  feedback.gain.value = 0.35;
  echo = c.createGain();
  echo.gain.value = 1;
  echo.connect(master);
  echo.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(master);
}

/**
 * Une note « à l'archet », façon violoncelle : deux dents de scie à peine désaccordées, adoucies par un filtre,
 * une attaque lente, un vibrato qui arrive après le début de la note et une longue extinction.
 */
function playNote() {
  if (!ctx || !echo || !playing) return;
  const c = ctx;
  const t = c.currentTime + 0.05;
  const freq = NOTES[Math.floor(Math.random() * NOTES.length)]!;
  const len = 2.5 + Math.random() * 2; // durée de l'archet
  const end = t + len + 2.5;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(freq * 2, t);
  filter.frequency.linearRampToValueAtTime(Math.min(freq * 6, 1400), t + 0.8);
  filter.frequency.linearRampToValueAtTime(freq * 2.5, t + len);
  const body = c.createBiquadFilter(); // résonance du corps de l'instrument
  body.type = 'peaking';
  body.frequency.value = 260;
  body.Q.value = 1.2;
  body.gain.value = 5;

  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.7);
  g.gain.linearRampToValueAtTime(0.055, t + len);
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  const vib = c.createOscillator();
  vib.frequency.value = 5 + Math.random();
  const vibDepth = c.createGain();
  vibDepth.gain.setValueAtTime(0, t);
  vibDepth.gain.linearRampToValueAtTime(freq * 0.006, t + 1.2);
  vib.connect(vibDepth);

  for (const detune of [-4, 5]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    vibDepth.connect(osc.frequency);
    osc.connect(filter);
    osc.start(t);
    osc.stop(end);
  }
  filter.connect(body).connect(g).connect(echo);
  vib.start(t);
  vib.stop(end);
}

function scheduleNotes() {
  if (noteTimer) clearTimeout(noteTimer);
  if (!playing || document.visibilityState !== 'visible') return;
  playNote();
  // Parfois deux notes qui se chevauchent, souvent un long silence.
  noteTimer = setTimeout(scheduleNotes, Math.random() < 0.2 ? 1500 : 4000 + Math.random() * 5000);
}

function onVisibility() {
  if (!ctx) return;
  if (document.visibilityState === 'visible' && playing) {
    ctx.resume().catch(() => {});
    scheduleNotes();
  } else {
    ctx.suspend().catch(() => {});
    if (noteTimer) clearTimeout(noteTimer);
  }
}

/** Démarre le son. À appeler depuis un geste de l'utilisateur (toucher), sinon le navigateur refuse. */
function start() {
  if (!ctx) {
    build();
    document.addEventListener('visibilitychange', onVisibility);
  }
  playing = true;
  ctx!.resume().catch(() => {});
  master!.gain.cancelScheduledValues(ctx!.currentTime);
  master!.gain.setTargetAtTime(0.85, ctx!.currentTime, 1.2);
  scheduleNotes();
}

function stop() {
  playing = false;
  if (noteTimer) clearTimeout(noteTimer);
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  const c = ctx;
  setTimeout(() => { if (!playing) c.suspend().catch(() => {}); }, 1500);
}

export function isPlaying() {
  return playing;
}

export function setSound(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* rien */ }
  if (on) start(); else stop();
  listeners.forEach((l) => l(on));
}

export function onSoundChange(cb: (on: boolean) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Si le son était activé la dernière fois, il reprend au premier toucher (les navigateurs l'exigent). */
export function resumeOnFirstTouch() {
  if (!soundWanted() || playing) return;
  const go = () => {
    window.removeEventListener('pointerdown', go);
    if (soundWanted() && !playing) setSound(true);
  };
  window.addEventListener('pointerdown', go, { once: true });
}

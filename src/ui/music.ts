import { sfx } from "./sfx";

export type Mood = "menu" | "night" | "day" | "tense" | "victory" | "defeat";

interface Track {
  bpm: number;
  /** 4 chords, 4 beats each (MIDI note numbers) */
  chords: number[][];
  bass: number[];
  bassStyle: "sustain" | "walk" | "pulse";
  padVol: number;
  /** chance per beat of a melody note */
  pluck: number;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

const TRACKS: Record<Mood, Track> = {
  // Smoky D-minor lounge
  menu: {
    bpm: 66,
    chords: [
      [62, 65, 69],
      [58, 62, 65],
      [55, 58, 62],
      [57, 61, 64],
    ], // Dm Bb Gm A
    bass: [38, 34, 31, 33],
    bassStyle: "walk",
    padVol: 0.05,
    pluck: 0.4,
  },
  night: {
    bpm: 54,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [50, 53, 57],
      [52, 56, 59],
    ], // Am F Dm E
    bass: [45, 41, 38, 40],
    bassStyle: "sustain",
    padVol: 0.05,
    pluck: 0.35,
  },
  day: {
    bpm: 78,
    chords: [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ], // C Am F G
    bass: [48, 45, 41, 43],
    bassStyle: "walk",
    padVol: 0.05,
    pluck: 0.5,
  },
  // Heartbeat bass for discussion and voting
  tense: {
    bpm: 100,
    chords: [
      [57, 60, 64],
      [57, 60, 64],
      [53, 57, 60],
      [52, 56, 59],
    ],
    bass: [45, 45, 41, 40],
    bassStyle: "pulse",
    padVol: 0.035,
    pluck: 0.15,
  },
  victory: {
    bpm: 88,
    chords: [
      [60, 64, 67],
      [65, 69, 72],
      [67, 71, 74],
      [60, 64, 67],
    ],
    bass: [48, 53, 55, 48],
    bassStyle: "walk",
    padVol: 0.05,
    pluck: 0.6,
  },
  defeat: {
    bpm: 48,
    chords: [
      [57, 60, 64],
      [55, 59, 62],
      [53, 57, 60],
      [52, 56, 59],
    ],
    bass: [45, 43, 41, 40],
    bassStyle: "sustain",
    padVol: 0.05,
    pluck: 0.2,
  },
};

const VOLUME = 0.7;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let section: GainNode | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let nextTime = 0;
let chordIndex = 0;
let mood: Mood = "night";
let running = false;

function ensure(): AudioContext {
  if (ctx) return ctx;
  const c = new AudioContext();
  ctx = c;

  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2200;
  lowpass.connect(master);

  bus = c.createGain();
  bus.connect(lowpass);

  // Echo for a bit of smoky-room space
  const delay = c.createDelay(1);
  delay.delayTime.value = 0.42;
  const feedback = c.createGain();
  feedback.gain.value = 0.32;
  const wet = c.createGain();
  wet.gain.value = 0.35;
  bus.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(lowpass);

  return c;
}

/** Start a fresh "section": fades the old mood out and the new one in. */
function newSection() {
  if (!ctx || !bus) return;
  const c = ctx;
  const old = section;
  if (old) {
    old.gain.cancelScheduledValues(c.currentTime);
    old.gain.setValueAtTime(old.gain.value, c.currentTime);
    old.gain.linearRampToValueAtTime(0.0001, c.currentTime + 1.2);
    window.setTimeout(() => old.disconnect(), 4000);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  g.connect(bus);
  section = g;
  nextTime = c.currentTime + 0.15;
  chordIndex = 0;
}

function note(
  midi: number,
  start: number,
  dur: number,
  o: { type: OscillatorType; vol: number; attack: number; detune?: number },
) {
  if (!ctx || !section) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type;
  osc.frequency.value = hz(midi);
  if (o.detune) osc.detune.value = o.detune;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(o.vol, start + o.attack);
  gain.gain.linearRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(section);
  osc.start(start);
  osc.stop(start + dur + 0.1);
}

function scheduleChord(t: number) {
  const p = TRACKS[mood];
  const beat = 60 / p.bpm;
  const len = beat * 4;
  const i = chordIndex % 4;
  const chord = p.chords[i];
  const bass = p.bass[i];

  // Pad
  for (const m of chord) {
    note(m, t, len * 1.1, {
      type: "triangle",
      vol: p.padVol,
      attack: len * 0.35,
    });
    note(m, t, len * 1.1, {
      type: "sine",
      vol: p.padVol * 0.8,
      attack: len * 0.35,
      detune: 7,
    });
  }

  // Bass
  if (p.bassStyle === "sustain") {
    note(bass, t, beat * 1.8, { type: "sine", vol: 0.16, attack: 0.05 });
    note(bass, t + beat * 2, beat * 1.8, {
      type: "sine",
      vol: 0.12,
      attack: 0.05,
    });
  } else if (p.bassStyle === "walk") {
    [0, 7, 12, 7].forEach((off, b) =>
      note(bass + off, t + b * beat, beat * 0.9, {
        type: "triangle",
        vol: 0.14,
        attack: 0.02,
      }),
    );
  } else {
    for (let k = 0; k < 8; k++) {
      note(bass, t + (k * beat) / 2, beat * 0.45, {
        type: "sine",
        vol: k % 2 === 0 ? 0.18 : 0.09,
        attack: 0.01,
      });
    }
  }

  // Sparse melody plucks
  for (let b = 0; b < 4; b++) {
    if (Math.random() > p.pluck) continue;
    const m = chord[Math.floor(Math.random() * chord.length)] + 12;
    note(m, t + b * beat, beat * 1.6, {
      type: "sine",
      vol: 0.07,
      attack: 0.01,
    });
  }
}

function tick() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 2) {
    scheduleChord(nextTime);
    nextTime += (60 / TRACKS[mood].bpm) * 4;
    chordIndex++;
  }
}

function applyVolume() {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(sfx.isMuted() ? 0 : VOLUME, ctx.currentTime, 0.5);
}

export const music = {
  /** Call from a click handler (browsers block audio until the user interacts). */
  start() {
    try {
      const c = ensure();
      if (c.state === "suspended") void c.resume();
      if (!running) {
        running = true;
        newSection();
        timer = window.setInterval(tick, 500);
        tick();
      }
      applyVolume();
    } catch {
      /* audio unavailable, ignore */
    }
  },
  stop() {
    running = false;
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    const c = ctx;
    if (c && master) {
      master.gain.setTargetAtTime(0, c.currentTime, 0.2);
      window.setTimeout(() => void c.close(), 1000);
    }
    ctx = null;
    bus = null;
    section = null;
    master = null;
  },
  /** Crossfades to the new mood straight away. */
  setMood(m: Mood) {
    if (m === mood) return;
    mood = m;
    if (running) newSection();
  },
  /** Call after the mute setting changes. */
  refresh: applyVolume,
};

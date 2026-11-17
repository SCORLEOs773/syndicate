import { sfx } from "./sfx";

type Mood = "night" | "day";

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Each progression is 4 chords, 4 beats per chord (MIDI note numbers)
const PROG = {
  night: {
    bpm: 54,
    chords: [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [50, 53, 57], // Dm
      [52, 56, 59], // E
    ],
    bass: [45, 41, 38, 40],
  },
  day: {
    bpm: 78,
    chords: [
      [60, 64, 67], // C
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [55, 59, 62], // G
    ],
    bass: [48, 45, 41, 43],
  },
} as const;

const VOLUME = 0.7;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
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

function note(
  midi: number,
  start: number,
  dur: number,
  o: { type: OscillatorType; vol: number; attack: number; detune?: number },
) {
  if (!ctx || !bus) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type;
  osc.frequency.value = hz(midi);
  if (o.detune) osc.detune.value = o.detune;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(o.vol, start + o.attack);
  gain.gain.linearRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.1);
}

function scheduleChord(t: number) {
  const p = PROG[mood];
  const beat = 60 / p.bpm;
  const len = beat * 4;
  const i = chordIndex % 4;
  const chord = p.chords[i];
  const bass = p.bass[i];

  // Pad
  for (const m of chord) {
    note(m, t, len * 1.1, { type: "triangle", vol: 0.05, attack: len * 0.35 });
    note(m, t, len * 1.1, {
      type: "sine",
      vol: 0.04,
      attack: len * 0.35,
      detune: 7,
    });
  }

  // Bass
  if (mood === "night") {
    note(bass, t, beat * 1.8, { type: "sine", vol: 0.16, attack: 0.05 });
    note(bass, t + beat * 2, beat * 1.8, {
      type: "sine",
      vol: 0.12,
      attack: 0.05,
    });
  } else {
    [0, 7, 12, 7].forEach((off, b) =>
      note(bass + off, t + b * beat, beat * 0.9, {
        type: "triangle",
        vol: 0.14,
        attack: 0.02,
      }),
    );
  }

  // Sparse melody plucks
  const chance = mood === "night" ? 0.35 : 0.5;
  for (let b = 0; b < 4; b++) {
    if (Math.random() > chance) continue;
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
    nextTime += (60 / PROG[mood].bpm) * 4;
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
        nextTime = c.currentTime + 0.1;
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
    master = null;
  },
  setMood(m: Mood) {
    mood = m; // takes effect from the next chord
  },
  /** Call after the mute setting changes. */
  refresh: applyVolume,
};

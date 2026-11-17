let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem("syndicate-muted") === "1";
} catch {
  /* storage unavailable, ignore */
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  dur: number,
  opts: {
    type?: OscillatorType;
    vol?: number;
    delay?: number;
    slideTo?: number;
  } = {},
) {
  const c = audio();
  if (!c) return;
  const { type = "sine", vol = 0.15, delay = 0, slideTo } = opts;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  click: () => tone(520, 0.08, { type: "square", vol: 0.04 }),
  night: () => {
    tone(110, 1.8, { vol: 0.16 });
    tone(164.8, 1.8, { vol: 0.08, delay: 0.1 });
  },
  dawn: () =>
    [523, 659, 784].forEach((f, i) =>
      tone(f, 1, { vol: 0.1, delay: i * 0.18 }),
    ),
  death: () => tone(200, 1, { type: "sawtooth", vol: 0.1, slideTo: 45 }),
  win: () =>
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.7, { vol: 0.1, delay: i * 0.15 }),
    ),
  lose: () =>
    [392, 330, 262, 196].forEach((f, i) =>
      tone(f, 0.8, { type: "triangle", vol: 0.12, delay: i * 0.2 }),
    ),
  isMuted: () => muted,
  setMuted: (m: boolean) => {
    muted = m;
    try {
      localStorage.setItem("syndicate-muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
  },
};

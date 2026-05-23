/**
 * Web Audio synth for the 旅ガチャ lottery prototype.
 * All sounds are synthesized — no external assets.
 */

type AudioCtxLike = AudioContext;

let ctx: AudioCtxLike | null = null;
let masterGain: GainNode | null = null;
let enabled = true;

function ensure(): AudioCtxLike {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function setEnabled(v: boolean) {
  enabled = !!v;
}

function isEnabled() {
  return enabled;
}

function tick({ freq = 1400, dur = 0.04, vol = 0.4 } = {}) {
  if (!enabled) return;
  const c = ensure();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(masterGain!);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

function blip({
  freq = 900,
  dur = 0.08,
  vol = 0.3,
  type = "sine" as OscillatorType,
} = {}) {
  if (!enabled) return;
  const c = ensure();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g);
  g.connect(masterGain!);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

function lockOn() {
  if (!enabled) return;
  const c = ensure();
  const now = c.currentTime;
  [
    { f: 880, t: 0 },
    { f: 660, t: 0.08 },
    { f: 440, t: 0.18 },
  ].forEach(({ f, t }) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.4, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.4);
    o.connect(g);
    g.connect(masterGain!);
    o.start(now + t);
    o.stop(now + t + 0.45);
  });
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, now);
  o.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.5, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  o.connect(g);
  g.connect(masterGain!);
  o.start(now);
  o.stop(now + 0.5);
}

function sweep({ from = 200, to = 1200, dur = 0.6, vol = 0.18 } = {}) {
  if (!enabled) return;
  const c = ensure();
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(from, now);
  o.frequency.exponentialRampToValueAtTime(to, now + dur);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(vol, now + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g);
  g.connect(masterGain!);
  o.start(now);
  o.stop(now + dur + 0.05);
}

function radarPing({ freq = 1200, dur = 0.4 } = {}) {
  if (!enabled) return;
  const c = ensure();
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, now);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, now + dur);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.25, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g);
  g.connect(masterGain!);
  o.start(now);
  o.stop(now + dur + 0.02);
}

type Rank = "S" | "A" | "B" | "C";

/**
 * S: 既存 lockOn の派手版 + 上昇アルペジオ (ファンファーレ感)
 * A: 既存 lockOn (現状の二音 + sub thud)
 * B: 軽い triangle 単音 + 軽い余韻
 * C: 下降 sawtooth (wamp wamp、ハズレ感)
 */
function lockOnByRank(rank: Rank) {
  if (!enabled) return;
  const c = ensure();
  const now = c.currentTime;

  if (rank === "S") {
    // 既存 lockOn を呼び、それに上昇アルペジオを重ねる
    lockOn();
    [
      { f: 660, t: 0.05 },
      { f: 880, t: 0.18 },
      { f: 1175, t: 0.31 },
      { f: 1568, t: 0.44 },
    ].forEach(({ f, t }) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, now + t);
      g.gain.linearRampToValueAtTime(0.32, now + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.32);
      o.connect(g);
      g.connect(masterGain!);
      o.start(now + t);
      o.stop(now + t + 0.36);
    });
    return;
  }

  if (rank === "A") {
    lockOn();
    return;
  }

  if (rank === "B") {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(420, now + 0.25);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    o.connect(g);
    g.connect(masterGain!);
    o.start(now);
    o.stop(now + 0.35);
    return;
  }

  // C: ハズレ感のある下降音
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(220, now);
  o.frequency.exponentialRampToValueAtTime(90, now + 0.5);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.28, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  o.connect(g);
  g.connect(masterGain!);
  o.start(now);
  o.stop(now + 0.6);
  // 2発目（"wamp wamp"の2拍目）
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o2.type = "sawtooth";
  o2.frequency.setValueAtTime(200, now + 0.32);
  o2.frequency.exponentialRampToValueAtTime(70, now + 0.78);
  g2.gain.setValueAtTime(0, now + 0.32);
  g2.gain.linearRampToValueAtTime(0.24, now + 0.34);
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  o2.connect(g2);
  g2.connect(masterGain!);
  o2.start(now + 0.32);
  o2.stop(now + 0.9);
}

export const SFX = {
  ensure,
  setEnabled,
  isEnabled,
  tick,
  blip,
  lockOn,
  lockOnByRank,
  sweep,
  radarPing,
};

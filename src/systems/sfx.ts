import { settings } from './settings';

/**
 * 🔊 효과음 — 파일 없이 Web Audio로 그때그때 합성한다 (도트를 코드로 찍는 것과 같은 방식).
 * 같은 소리가 한 프레임에 몰리면 시끄러우니 소리마다 최소 간격을 둔다.
 */
export type Sfx =
  | 'hit'
  | 'crit'
  | 'kill'
  | 'hurt'
  | 'swing'
  | 'throw'
  | 'arrow'
  | 'bell'
  | 'fox'
  | 'dash'
  | 'soul'
  | 'levelup'
  | 'correct'
  | 'wrong'
  | 'warn'
  | 'boom'
  | 'swap'
  | 'click';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const last: Partial<Record<Sfx, number>> = {};
/** 소리마다 최소 간격 (ms) */
const GAP: Partial<Record<Sfx, number>> = { hit: 45, crit: 60, kill: 40, soul: 30, swing: 60, throw: 60, arrow: 60, fox: 80, boom: 80, warn: 120 };

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    // 흰 소음 1초 (타격 · 바람 소리의 재료)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** 첫 클릭 · 키 입력 때 오디오를 깨운다 (브라우저 자동재생 정책) */
export function unlockAudio(): void {
  const a = audio();
  if (a && a.state === 'suspended') void a.resume();
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** 음높이가 미끄러지는 단음 */
function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, attack = 0.005): void {
  const a = ctx!;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, vol, attack, dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + attack + dur + 0.02);
}

/** 걸러 낸 소음 (타격 · 바람 · 종이) */
function noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1 = f0, delay = 0, q = 1): void {
  const a = ctx!;
  const t = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const bq = a.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = a.createGain();
  env(g, t, vol, 0.004, dur);
  src.connect(bq).connect(g).connect(master!);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.03);
}

/** 효과음 재생. pitch로 음높이를 살짝 바꿀 수 있다 (연속 처치 등) */
export function sfx(name: Sfx, pitch = 1): void {
  if (settings.sfx <= 0) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const now = performance.now();
  if (now - (last[name] ?? 0) < (GAP[name] ?? 0)) return;
  last[name] = now;
  master!.gain.value = settings.sfx * 0.55;
  const p = pitch * (0.96 + Math.random() * 0.08);
  switch (name) {
    case 'hit':
      noise(0.07, 0.5, 'lowpass', 2400 * p, 300);
      tone('square', 180 * p, 70, 0.06, 0.12);
      break;
    case 'crit':
      noise(0.09, 0.6, 'bandpass', 3200 * p, 900, 0, 0.8);
      tone('square', 520 * p, 160, 0.09, 0.14);
      tone('sine', 1560 * p, 1500, 0.12, 0.08, 0.01);
      break;
    case 'kill':
      tone('square', 640 * p, 90, 0.14, 0.13);
      noise(0.16, 0.45, 'lowpass', 3000, 200);
      tone('sine', 1200 * p, 2000 * p, 0.08, 0.06, 0.04);
      break;
    case 'hurt':
      tone('sawtooth', 220, 60, 0.22, 0.16);
      noise(0.12, 0.5, 'lowpass', 900, 120);
      break;
    case 'swing':
      noise(0.11, 0.35, 'bandpass', 900 * p, 3800 * p, 0, 1.4);
      break;
    case 'throw':
      noise(0.06, 0.28, 'highpass', 3500 * p, 6000, 0, 0.7);
      tone('triangle', 900 * p, 1400 * p, 0.05, 0.05);
      break;
    case 'arrow':
      tone('triangle', 420 * p, 140, 0.12, 0.16);
      noise(0.08, 0.25, 'highpass', 4000, 7000, 0.02);
      break;
    case 'bell':
      for (const [f, v] of [
        [1320, 0.09],
        [1980, 0.05],
        [2640, 0.03],
      ] as const)
        tone('sine', f * p, f * p * 0.995, 0.5, v, 0, 0.002);
      break;
    case 'fox':
      noise(0.16, 0.18, 'bandpass', 600, 1800, 0, 2);
      tone('sine', 380 * p, 760 * p, 0.14, 0.07);
      break;
    case 'dash':
      noise(0.2, 0.45, 'bandpass', 500, 4000, 0, 1.2);
      tone('sine', 200, 420, 0.15, 0.06);
      break;
    case 'soul':
      tone('sine', 880 * p, 1320 * p, 0.07, 0.07);
      tone('triangle', 1760 * p, 1760 * p, 0.05, 0.03, 0.03);
      break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.07, i * 0.07));
      tone('sine', 2093, 2093, 0.35, 0.05, 0.28);
      break;
    case 'correct':
      tone('sine', 988, 988, 0.1, 0.1);
      tone('sine', 1319, 1319, 0.22, 0.1, 0.08);
      break;
    case 'wrong':
      tone('square', 200, 140, 0.18, 0.09);
      tone('square', 150, 110, 0.22, 0.08, 0.12);
      break;
    case 'warn':
      tone('sawtooth', 110, 90, 0.25, 0.07, 0, 0.03);
      break;
    case 'boom':
      tone('sine', 120, 35, 0.4, 0.35);
      noise(0.3, 0.6, 'lowpass', 1200, 80);
      break;
    case 'swap':
      tone('triangle', 660, 990, 0.06, 0.07);
      noise(0.05, 0.15, 'highpass', 5000, 8000, 0.02);
      break;
    case 'click':
      tone('square', 1200, 900, 0.03, 0.04);
      break;
  }
}

// 첫 입력에서 오디오를 깨운다
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { capture: true });

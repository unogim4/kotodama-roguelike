import Phaser from 'phaser';
import { sfx, Sfx } from '../systems/sfx';
import { settings } from '../systems/settings';

/**
 * 🎬 장면 전환 (영상의 장면 전환 기법을 게임으로).
 * - 먹 붓 와이프: 먹 붓질이 화면을 쓸어 덮었다가, 같은 방향으로 걷히며 다음 장면이 드러난다
 * - 휩 팬: 화면이 옆으로 휙 쓸리며(번짐 + 속도선) 다음 장면이 반대쪽에서 들어온다
 * - 스매시 컷: 번쩍 + 쾅 — 조용한 화면에서 곧바로 전투로 끊어 들어간다
 * - J컷: 다음 장면의 소리가 화면보다 먼저 들린다
 * 전환 요소는 #ui에 직접 붙어 장면이 바뀌어도 남는다.
 */

const INK_W = 1000;
let inkCanvas: HTMLCanvasElement | null = null;

/** 먹 띠: 양쪽 끝이 갈라진 붓 자국 (한 번만 그린다) */
function inkBand(): HTMLCanvasElement {
  if (inkCanvas) return inkCanvas;
  const W = INK_W;
  const H = 360;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const smooth = (y: number, seed: number, s: number) => {
    const i = Math.floor(y / s);
    const f = y / s - i;
    const a = rnd(i + seed);
    const b = rnd(i + 1 + seed);
    return a + (b - a) * (f * f * (3 - 2 * f));
  };
  for (let y = 0; y < H; y++) {
    // 붓끝: 굵은 물결 + 잔 떨림
    const left = 30 + smooth(y, 3, 40) * 90 + rnd(y * 7.3) * 14;
    const right = W - 40 - smooth(y, 11, 34) * 100 - rnd(y * 3.1) * 16;
    // 마른 붓 결: 몇몇 줄은 끝쪽이 비어 있다
    const dryL = rnd(y * 1.7) < 0.22 ? 20 + rnd(y * 9.1) * 50 : 0;
    const dryR = rnd(y * 2.3) < 0.25 ? 20 + rnd(y * 5.9) * 60 : 0;
    for (let x = 0; x < W; x++) {
      if (x < left || x > right) continue;
      if (x < left + dryL && rnd(x * 0.37 + y) < 0.55) continue;
      if (x > right - dryR && rnd(x * 0.71 + y * 3) < 0.55) continue;
      const i = (y * W + x) * 4;
      // 먹의 농담 — 결을 따라 아주 살짝
      const tone = 18 + Math.floor(smooth(x, y % 9, 23) * 10);
      img.data[i] = tone;
      img.data[i + 1] = tone - 4;
      img.data[i + 2] = tone + 10;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  inkCanvas = c;
  return c;
}

function uiRoot(): HTMLElement {
  return document.getElementById('ui')!;
}

let busy = false;

/** 애니메이션이 끝나면 — 화면이 안 그려지는 상황(숨은 탭 등)에도 시간이 되면 반드시 */
function after(anim: Animation, ms: number, fn: () => void): void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fn();
  };
  anim.onfinish = go;
  window.setTimeout(go, ms + 120);
}

/** 먹 붓 와이프 — 덮이는 순간 start()로 장면을 바꾼다 */
export function inkWipe(start: () => void, label?: string): void {
  if (busy) return start();
  busy = true;
  const wrap = document.createElement('div');
  wrap.className = 'ink-wipe';
  const band = inkBand();
  const img = document.createElement('canvas');
  img.width = band.width;
  img.height = band.height;
  img.getContext('2d')!.drawImage(band, 0, 0);
  wrap.appendChild(img);
  const text = document.createElement('div');
  text.className = 'ink-label';
  if (label) text.innerHTML = label;
  wrap.appendChild(text);
  uiRoot().appendChild(wrap);
  sfx('brush');
  const cover = img.animate([{ transform: `translateX(${-INK_W}px)` }, { transform: 'translateX(-145px)' }], { duration: 340, easing: 'cubic-bezier(.6,0,.9,.6)', fill: 'forwards' });
  after(cover, 340, () => {
    start();
    if (label) text.classList.add('on');
    window.setTimeout(() => {
      text.classList.remove('on');
      sfx('brush', 1.3);
      const reveal = img.animate([{ transform: 'translateX(-145px)' }, { transform: 'translateX(660px)' }], { duration: 420, easing: 'cubic-bezier(.2,.5,.4,1)', fill: 'forwards' });
      after(reveal, 420, () => {
        wrap.remove();
        busy = false;
      });
    }, label ? 520 : 160);
  });
}

/** 휩 팬 — 화면이 옆으로 휙 쓸려 넘어간다 */
export function whipPan(game: Phaser.Game, start: () => void, dir: 1 | -1 = 1): void {
  if (busy) return start();
  busy = true;
  const cv = game.canvas;
  const lines = document.createElement('div');
  lines.className = 'whip-lines';
  uiRoot().appendChild(lines);
  sfx('whoosh');
  const reduced = settings.motion === 'reduced';
  const d = reduced ? 20 : 70;
  const out = cv.animate(
    [
      { transform: 'translateX(0)', filter: 'blur(0px)' },
      { transform: `translateX(${-d * dir}px)`, filter: `blur(${reduced ? 1 : 3}px)` },
    ],
    { duration: 150, easing: 'ease-in', fill: 'forwards' },
  );
  lines.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: 'forwards' });
  after(out, 150, () => {
    start();
    const back = cv.animate(
      [
        { transform: `translateX(${d * dir}px)`, filter: `blur(${reduced ? 1 : 3}px)` },
        { transform: 'translateX(0)', filter: 'blur(0px)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
    lines.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    after(back, 200, () => {
      back.cancel();
      out.cancel();
      lines.remove();
      busy = false;
    });
  });
}

/** 스매시 컷 — 번쩍 + 쾅, 곧바로 다음 장면 */
export function smashCut(start: () => void, label?: string): void {
  sfx('boom');
  const flash = document.createElement('div');
  flash.className = 'smash-flash';
  if (label) flash.innerHTML = `<b>${label}</b>`;
  uiRoot().appendChild(flash);
  start();
  after(flash.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 420, fill: 'forwards' }), 420, () => flash.remove());
}

/** J컷 — 다음 장면의 소리를 먼저 들려주고 delay 뒤에 전환 */
export function jCut(sound: Sfx, delay: number, then: () => void): void {
  sfx(sound);
  window.setTimeout(then, delay);
}

import Phaser from 'phaser';

/** 빛나는 것 하나 */
export interface LightSrc {
  x: number;
  y: number;
  r: number;
  /** 색이 있는 빛 웅덩이 (없으면 어둠만 걷어 낸다) */
  color?: number;
  /** 0~1 세기 */
  i?: number;
}

const LIGHT = 'light-soft';
const PAD = 90;

/** 부드러운 원형 빛 (가운데 1 → 가장자리 0) */
function lightTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(LIGHT)) return;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  scene.textures.addCanvas(LIGHT, c);
}

/**
 * 💡 어둠 + 빛 — 저녁 · 숲 · 밤 싸움터를 어둡게 깔고, 코토하 · 석등 · 불씨 · 혼백 둘레만 걷어 낸다.
 * 카메라가 보는 자리만 그리는 렌더 텍스처 (월드 좌표라 줌 · 기울기를 그대로 따른다).
 * 깊이 2000: 요괴 · 주인공(발 y) 위, 휘두르기 · 숫자(4400~) 아래 — 공격 연출은 밝게 남는다.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private brush: Phaser.GameObjects.Image | null = null;
  private glows: Phaser.GameObjects.Image[] = [];
  private t = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly color: number,
    private readonly alpha: number,
    private readonly sources: () => LightSrc[],
  ) {
    if (alpha <= 0) return;
    lightTexture(scene);
    this.rt = scene.add.renderTexture(0, 0, 640 + PAD * 2, 360 + PAD * 2).setOrigin(0).setDepth(2000);
    this.brush = scene.make.image({ key: LIGHT, add: false }).setOrigin(0.5);
  }

  update(dt: number): void {
    if (!this.rt || !this.brush) return;
    this.t += dt;
    const v = this.scene.cameras.main.worldView;
    const ox = Math.floor(v.x - PAD);
    const oy = Math.floor(v.y - PAD);
    const rt = this.rt;
    rt.setPosition(ox, oy);
    rt.clear();
    rt.fill(this.color, this.alpha);
    const list = this.sources();
    let gi = 0;
    for (const s of list) {
      if (s.x < ox - s.r || s.y < oy - s.r || s.x > ox + rt.width + s.r || s.y > oy + rt.height + s.r) continue;
      // 불빛은 살짝 일렁인다
      const flick = s.color ? 1 + Math.sin(this.t / 90 + s.x) * 0.04 + Math.sin(this.t / 37 + s.y) * 0.03 : 1;
      this.brush.setScale(((s.r * 2) / 128) * flick).setAlpha(s.i ?? 1);
      rt.erase(this.brush, s.x - ox, s.y - oy);
      if (s.color) {
        // 색 있는 빛 웅덩이 (어둠 위에 더하기)
        let gl = this.glows[gi];
        if (!gl) {
          gl = this.scene.add.image(0, 0, LIGHT).setBlendMode(Phaser.BlendModes.ADD).setDepth(2001);
          this.glows.push(gl);
        }
        gl.setVisible(true).setPosition(s.x, s.y).setTint(s.color).setScale(((s.r * 1.5) / 128) * flick).setAlpha(0.22 * (s.i ?? 1));
        gi++;
      }
    }
    for (let k = gi; k < this.glows.length; k++) this.glows[k].setVisible(false);
  }
}

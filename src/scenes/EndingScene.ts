import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { Dialogue, Line } from '../ui/Dialogue';
import { HD, registerHd } from '../art/hd/register';
import { summitGround, SUMMIT_W } from '../art/hd/summit';
import { registerBosses, arenaGround } from '../art/hd/bossArt';
import { nodeIcon } from '../art/hd/worldMap';
import { alleyBackground, ALLEY } from '../art/hd/alley';
import { villager } from '../art/hd/visit';
import { softGlow } from '../art/hd/library';
import { journey, newJourney, unlockArms } from '../systems/journey';
import { ARSENAL, ArmsId } from '../data/arsenal';
import { run } from '../systems/run';
import { clearSave, saveJourney } from '../systems/save';
import { markSeen } from '../systems/profile';
import { BLESSINGS, GODS } from '../data/blessings';
import { chapterDef, LAST_CHAPTER, rowShort } from '../data/chapters';
import { ROWS, Kana, matchesKo } from '../data/kana';
import { HangulSyllableTyper } from '../util/hangulKeys';
import { tts } from '../systems/tts';

/** 장마다 다른 엔딩 대사 */
interface EndingScript {
  /** 쓰러진 보스와의 대화 (마지막 언령 앞) */
  before: Line[];
  ritualHead: string;
  /** 마지막 언령을 들은 보스 */
  after: Line[];
  /** 빛이 풀려난 뒤 */
  release: Line[];
  village: Line[];
  /** 마을 간판 (돌아온 글자) */
  signs: string[];
}

const SCRIPTS: Record<number, EndingScript> = {
  1: {
    before: [
      { who: 'yamabiko', text: '……왜 막았어. 이 소리들은… 내 거야.' },
      { who: 'kotoha', text: '마을 사람들 목소리잖아. 다들 말을 못 해서 곤란해하고 있어.' },
      { who: 'yamabiko', text: '…산에 대고 아무리 외쳐도, 아무도 대답해 주지 않았어.' },
      { who: 'yamabiko', text: '사람들 소리를 모으면… 메아리라도 돌아오니까. 혼자가 아니니까.' },
      { who: 'kon', face: 'sad', text: '…외로웠구나.' },
      { who: 'kotoha', face: 'normal', text: '그럼 내가 대답할게. 잘 들어!' },
    ],
    ritualHead: '산을 향해 외치자 — <b>마지막 언령</b>',
    after: [
      { who: 'yamabiko', face: 'surprised', text: '……{こ}、{え}…! 대답이… 돌아왔어!' },
      { who: 'yamabiko', face: 'happy', text: '산이… 나한테 대답했어.' },
    ],
    release: [
      { who: 'fumi', text: '(두루마리 속에서) …잘했다, 코토하. 그것이 언령이다.' },
      { who: 'kotoha', face: 'happy', text: '스승님…!' },
      { who: 'yamabiko', text: '목소리, 돌려줄게. …가끔, 산에 대고 불러 줄래?' },
      { who: 'kotoha', face: 'happy', text: '응! 약속할게.' },
    ],
    village: [
      { who: 'villager', text: '아… 아아! 목소리가… 돌아왔다!' },
      { who: 'villager', text: '고맙다, 꼬마 무녀님! 간판도 다시 읽을 수 있게 됐어.' },
      { who: 'kon', face: 'happy', text: '히히, 우리 덕분이지!' },
      { who: 'kotoha', face: 'happy', text: '다음 마을에도… 사라진 글자를 찾으러 가자!' },
    ],
    signs: ['かき', 'おかき', 'いか', 'えき'],
  },
  2: {
    before: [
      { who: 'kappa', text: '…다가오지 마! 이 글자들은 못 줘!' },
      { who: 'kotoha', text: '마을 사람들이 글자를 잃어서 곤란해하고 있어. 왜 강바닥에 숨긴 거야?' },
      { who: 'kappa', text: '숨긴 게 아니야… 지킨 거야. 모지쿠이가 글자를 먹으러 다닌다고 해서.' },
      { who: 'kappa', text: '강바닥 깊이 묻어 두면… 아무도 못 먹을 줄 알았어.' },
      { who: 'kon', face: 'sad', text: '…지켜 주려던 거였구나.' },
      { who: 'kotoha', face: 'normal', text: '고마워, 갓파. 이제는 우리가 지킬게. 이 말을 들어 봐!' },
    ],
    ritualHead: '강물을 향해 말하자 — <b>마지막 언령</b>',
    after: [
      { who: 'kappa', face: 'surprised', text: '……{たいせつ}. 소중하다는… 말.' },
      { who: 'kappa', face: 'happy', text: '그래, 소중하니까 숨겼던 거야. …이제 돌려줄게.' },
    ],
    release: [
      { who: 'fumi', text: '(방울이 울린다) …소중한 것을 지키는 방법은 하나가 아니란다.' },
      { who: 'kotoha', face: 'happy', text: '스승님 목소리가 점점 또렷해져…!' },
      { who: 'kappa', text: '가끔 오이 가져와. …그럼 강은 내가 깨끗하게 지킬게.' },
    ],
    village: [
      { who: 'villager', text: '강에서 글자들이 떠올랐다! 아이들이 다시 물가에서 놀아.' },
      { who: 'villager', text: '간판 글자도 돌아왔어. 고맙다, 무녀님!' },
      { who: 'kon', face: 'happy', text: '갓파도 사실은 착한 녀석이었지!' },
      { who: 'kotoha', face: 'happy', text: '숲 너머에도 사라진 글자가 있대. 가 보자!' },
    ],
    signs: ['なし', 'たこ', 'はな', 'ひと'],
  },
  3: {
    before: [
      { who: 'tengu', text: '…훌륭하다. 내 깃털을 이만큼 견딘 자는 오랜만이군.' },
      { who: 'kotoha', text: '이제 길을 열어 줄 거야?' },
      { who: 'tengu', text: '마지막이다. 언령사란, 자기 자신을 스스로 말할 수 있는 자.' },
      { who: 'tengu', text: '너는 누구냐? 남의 글자가 아니라 — 네 글자로 말해 보아라.' },
      { who: 'kon', face: 'happy', text: '코토하, 할 수 있어!' },
    ],
    ritualHead: '숲을 향해, 나를 — <b>마지막 언령</b>',
    after: [
      { who: 'kotoha', face: 'happy', text: '……{わたし}. 나. 이게 나야!' },
      { who: 'tengu', text: '좋다. 그 글자를 잊지 마라. 말은 누군가 들어 줄 때 비로소 맺히는 법이다.' },
      { who: 'tengu', text: '모지쿠이도 처음엔… 아무도 들어 주지 않은 말 한마디였지.' },
    ],
    release: [
      { who: 'fumi', text: '(방울이 울린다) 코토하. 네가… 처음으로 너를 글자로 썼구나.' },
      { who: 'kotoha', face: 'happy', text: '응! 스승님, 들었어요?' },
      { who: 'tengu', text: '도성으로 가라. 그곳의 오니는… 오래 삼킨 말이 있다.' },
    ],
    village: [
      { who: 'villager', text: '숲길이 열렸다! 이제 장터에 갈 수 있어.' },
      { who: 'kon', face: 'happy', text: '코토하, 아까 그 글자 또 써 줘! {わたし}!' },
      { who: 'kotoha', face: 'happy', text: '헤헤… 이제 쓸 수 있어. 내 글자로.' },
      { who: 'kotoha', text: '옛 도성으로 가자. 오니가 기다리고 있대.' },
    ],
    signs: ['やま', 'もり', 'ゆき', 'わに'],
  },
  4: {
    before: [
      { who: 'oni', text: '……크으. 말이… 목에 걸려서… 나오지 않는다.' },
      { who: 'kotoha', text: '오니… 너도 모지쿠이한테 먹혀 버린 거야?' },
      { who: 'oni', text: '오래전… 동생에게 해야 할 말이 있었다. 끝내 하지 못했지.' },
      { who: 'oni', text: '그 말을 삼키고 또 삼키다가… 이렇게 돼 버렸다.' },
      { who: 'kon', face: 'sad', text: '…그 말, 우리가 같이 꺼내 주자.' },
      { who: 'kotoha', face: 'normal', text: '같이 말하자. 점도, 작은 글자도 이제 다 돌아왔으니까!' },
    ],
    ritualHead: '오니와 함께 — <b>마지막 언령</b>',
    after: [
      { who: 'oni', face: 'surprised', text: '……{ごめんなさい}. ……미안하다. 미안했다.' },
      { who: 'oni', face: 'happy', text: '이제야… 가벼워졌다.' },
    ],
    release: [
      { who: 'fumi', text: '(방울이 크게 울린다) 코토하. 히라가나가 모두 돌아왔구나.' },
      { who: 'fumi', text: '허나 사람들의 말이 아직 어딘가 비어 있다. 바다 건너 온 말이 없어.' },
      { who: 'fumi', text: '항구로 가거라. {みなと}.' },
      { who: 'kotoha', face: 'happy', text: '미나토… 알겠어요, 스승님!' },
    ],
    village: [
      { who: 'villager', text: '도성에 글자가 돌아왔다! 점 하나, 작은 글자 하나까지!' },
      { who: 'villager', text: '{ありがとう}… 이 말을 다시 할 수 있게 됐어. 고맙다!' },
      { who: 'kon', face: 'happy', text: '히라가나 전부 되찾았어! 코토하 최고!' },
      { who: 'kotoha', face: 'happy', text: '다음은 바다 건너 온 글자… 항구로 가자!' },
    ],
    signs: ['すし', 'がっこう', 'でんしゃ', 'ぱん'],
  },
};

const ALL_KANA = ROWS.flatMap((r) => r.kana);

/**
 * 🌄 장 엔딩 — 쓰러진 보스와 대화 → 마지막 언령을 직접 외친다(한글 입력)
 * → 보스가 대답하고 빼앗긴 것이 돌아온다 → 마을 골목 → 장 완료 카드 → 결과 요약 → 다음 장 / 타이틀.
 */
export class EndingScene extends Phaser.Scene {
  private ui!: UILayer;
  private dlg!: Dialogue;
  private boss = { correct: 0, total: 0 };
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private num = 1;
  private tex: string = HD.yamabiko;

  constructor() {
    super('Ending');
  }

  init(data: { correct?: number; total?: number }): void {
    this.boss = { correct: data.correct ?? 0, total: data.total ?? 0 };
  }

  private get def() {
    return chapterDef(this.num);
  }

  private get script(): EndingScript {
    return SCRIPTS[this.num] ?? SCRIPTS[1];
  }

  create(): void {
    registerHd(this);
    registerBosses(this);
    this.num = journey.chapter;
    const id = this.def.boss.id;
    this.tex = id === 'yamabiko' ? HD.yamabiko : `boss-${id}`;
    const tex = (key: string, make: () => HTMLCanvasElement) => !this.textures.exists(key) && this.textures.addCanvas(key, make());
    const ground = id === 'yamabiko' ? 'summit' : `arena-${id}`;
    tex(ground, () => (id === 'yamabiko' ? summitGround() : arenaGround(id)));
    tex('map-icon-fox', () => nodeIcon('fox'));
    tex('npc-villager', () => villager().canvas());
    tex('lib-glow', () => softGlow());
    this.add.image(0, 0, ground).setOrigin(0);
    // 싸움터의 한 장면만 보여 준다 (보스가 섰던 자리)
    this.cameras.main.setScroll(SUMMIT_W / 2 - 320, 40);

    const cx = SUMMIT_W / 2;
    this.add.ellipse(cx, 300, 64, 18, 0x000000, 0.35);
    this.add.sprite(cx, 300, this.tex, 0).setOrigin(0.5, 1).setName('yama');
    this.add.ellipse(cx - 30, 352, 18, 6, 0x000000, 0.3);
    this.add.sprite(cx - 30, 352, HD.player, 0).setOrigin(0.5, 1).play('p-idle');
    this.add.image(cx - 54, 354, 'map-icon-fox').setOrigin(0.5, 1);

    this.cameras.main.fadeIn(800, 12, 10, 18);
    this.ui = new UILayer(this);
    this.dlg = new Dialogue(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dlg.close();
      if (this.onKey) window.removeEventListener('keydown', this.onKey);
    });
    this.time.delayedCall(900, () => void this.arena());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  // ── 싸움터 ───────────────────────────────────────────

  private async arena(): Promise<void> {
    await this.dlg.play(this.script.before);
    await this.ritual();
    await this.echo();
    await this.dlg.play(this.script.after);
    this.releaseVoices();
    await this.wait(1200);
    await this.dlg.play(this.script.release);
    await this.village();
  }

  /** 마지막 언령 — 한글로 한 음절씩 입력해 외친다 (ん 같은 받침 글자는 저절로 채워진다) */
  private ritual(): Promise<void> {
    const fin = this.def.final;
    const word = fin.kana.map((k, i) => ({ kana: k, ko: fin.ko[i], ref: ALL_KANA.find((x) => x.kana === k) }));
    const typedCount = word.filter((w) => w.ko).length;
    const matches = (w: { ko: string | null; ref?: Kana }, syl: string) => syl === w.ko || (!!w.ref && matchesKo(w.ref, syl));
    return new Promise((resolve) => {
      const box = this.ui.el('div', 'ritual fade-in');
      this.ui.el('div', 'ritual-head', this.script.ritualHead, box);
      const row = this.ui.el('div', 'ritual-word', '', box);
      const cells = word.map((w) => this.ui.el('span', 'jp', w.kana, row));
      const typed = this.ui.el('div', 'ritual-typed', '<span class="caret">_</span>', box);
      const hint = this.ui.el('div', 'ritual-hint', `${typedCount}글자를 차례로 <b>한글로 입력</b> (한/영 상관없이)`, box);
      let i = 0;
      let wrong = 0;
      const typer = new HangulSyllableTyper();
      const finish = () => {
        window.removeEventListener('keydown', this.onKey!);
        this.onKey = null;
        this.time.delayedCall(500, () => {
          box.remove();
          resolve();
        });
      };
      /** 지금 칸으로 — 입력이 필요 없는 칸(ん)은 저절로 채운다 */
      const advance = (): boolean => {
        while (i < word.length && !word[i].ko) {
          cells[i].classList.add('done');
          void tts.speak(word[i].kana);
          i++;
        }
        if (i >= word.length) {
          finish();
          return false;
        }
        cells[i].classList.add('now');
        return true;
      };
      this.onKey = (e: KeyboardEvent) => {
        if (document.querySelector('.settings-panel')) return;
        const handled = typer.handle(
          e,
          (p) => (typed.innerHTML = p ? `<b>${p}</b>` : '<span class="caret">_</span>'),
          (syl) => {
            if (matches(word[i], syl)) {
              cells[i].classList.remove('now');
              cells[i].classList.add('done');
              void tts.speak(word[i].kana);
              i++;
              typed.innerHTML = '<span class="caret">_</span>';
              advance();
            } else {
              wrong++;
              box.classList.remove('shake');
              void box.offsetWidth;
              box.classList.add('shake');
              typed.innerHTML = `<i>${syl}</i>`;
              if (wrong >= 2) hint.innerHTML = `힌트: <b>${word.map((w) => w.ko ?? `(${w.kana})`).join(' · ')}</b>`;
            }
          },
        );
        if (handled) e.preventDefault();
      };
      window.addEventListener('keydown', this.onKey);
      advance();
    });
  }

  /** 마지막 언령이 메아리처럼 퍼진다 */
  private async echo(): Promise<void> {
    const w = this.def.final.word;
    void tts.speak(`${w}!`);
    this.cameras.main.shake(400, 0.005);
    for (let k = 0; k < 4; k++) {
      const el = this.ui.el('div', 'echo-word jp', w);
      el.style.setProperty('--k', String(k));
      this.ui.place(el, 320 + (k % 2 ? 1 : -1) * k * 60, 120 - k * 14);
      this.time.delayedCall(1800, () => el.remove());
      await this.wait(380);
    }
    const yama = this.children.getByName('yama') as Phaser.GameObjects.Sprite;
    yama.setTexture(this.tex, 1);
    await this.wait(700);
  }

  /** 빼앗겼던 것이 빛이 되어 마을로 */
  private releaseVoices(): void {
    const yama = this.children.getByName('yama') as Phaser.GameObjects.Sprite;
    yama.setTexture(this.tex, 0);
    const glow = this.add.image(yama.x, yama.y - 40, 'lib-glow').setScale(2.6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.9, duration: 500, yoyo: true, hold: 600 });
    for (let i = 0; i < 40; i++) {
      const d = this.add.circle(yama.x + (Math.random() - 0.5) * 40, yama.y - 40, 2, i % 3 ? 0xffe39a : 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: d,
        x: yama.x - 300 + Math.random() * 600,
        y: yama.y + 260 + Math.random() * 80,
        alpha: 0,
        delay: i * 40,
        duration: 1400,
        ease: 'Sine.easeIn',
        onComplete: () => d.destroy(),
      });
    }
  }

  // ── 마을 ─────────────────────────────────────────────

  private async village(): Promise<void> {
    const cam = this.cameras.main;
    cam.fadeOut(600, 12, 10, 18);
    await this.wait(700);
    this.children.removeAll(true);
    cam.setScroll(0, 0);
    const key = 'alley-ending';
    if (!this.textures.exists(key)) this.textures.addCanvas(key, alleyBackground(['kaki', 'okaki', 'ika', 'eki']));
    this.add.image(0, 0, key).setOrigin(0);
    const signs = this.script.signs.map((w, i) => {
      const el = this.ui.el('div', 'alley-sign jp', w);
      this.ui.place(el, ALLEY.shopXs[i], ALLEY.signY);
      return el;
    });
    this.add.sprite(240, 254, HD.player, 0).setOrigin(0.5, 1).play('p-idle');
    this.add.image(216, 256, 'map-icon-fox').setOrigin(0.5, 1);
    this.add.image(400, 254, 'npc-villager').setOrigin(0.5, 1).setFlipX(true);
    this.add.image(470, 254, 'npc-villager').setOrigin(0.5, 1).setTint(0xd8c8f0);
    cam.fadeIn(600, 12, 10, 18);
    await this.wait(700);
    await this.dlg.play(this.script.village);
    signs.forEach((s) => s.remove());
    this.titleCard();
  }

  private titleCard(): void {
    const fin = this.def.final;
    const card = this.ui.el('div', 'title-card');
    card.innerHTML = `<b>마지막 언령</b><span class="jp">${fin.word}</span><small>${fin.meaning} — ${fin.note}</small><b class="done">${this.num}장 · ${this.def.title} 완료</b>`;
    this.time.delayedCall(3600, () => {
      card.remove();
      this.summary();
    });
  }

  // ── 결과 요약 ─────────────────────────────────────────

  private summary(): void {
    const num = this.num;
    markSeen(`ch${num}-clear`);
    const b = journey.build;
    const kana = this.def.rows.flatMap((r) => ROWS[r].kana);
    const wrong = kana.filter((k) => run.wrong[k.kana]).sort((x, y) => run.wrong[y.kana] - run.wrong[x.kana]).slice(0, 3);
    const wrongText = wrong.length ? `가장 많이 틀린 글자 ${wrong.map((k) => `<span class="jp">${k.kana}</span>[${k.ko}]×${run.wrong[k.kana]}`).join(' · ')}` : '틀린 글자 없음 — 완벽해요!';
    const mins = Math.max(1, Math.round((Date.now() - (journey.startedAt || Date.now())) / 60000));
    const time = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
    const bless = b.blessings
      .map((id) => BLESSINGS.find((x) => x.id === id))
      .filter((x) => x)
      .map((x) => `${GODS[x!.god].icon} ${x!.name}`)
      .join(' · ');
    const last = num >= LAST_CHAPTER;

    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in result-panel');
    this.ui.el('h2', '', `🌄 ${num}장 결과`, panel);
    this.ui.el('p', '', `이번 장에서 되찾은 글자 <b>${kana.length}</b>자`, panel);
    const grid = this.ui.el('div', 'row result-kana', '', panel);
    // 글자가 많은 장(4장)은 행 묶음으로 보여 준다
    if (kana.length > 30) this.def.rows.forEach((r) => this.ui.el('div', 'kana wide', `${ROWS[r].name} <b>${ROWS[r].kana.length}</b>`, grid));
    else kana.forEach((k) => this.ui.el('div', 'kana', k.kana, grid));
    this.ui.el(
      'p',
      'result-lines',
      [
        `보스 퀴즈 <b>${this.boss.correct} / ${this.boss.total}</b> 정답`,
        wrongText,
        `받은 가호 ${bless || '없음'}`,
        `레벨 <b>${b.level}</b> · 언령 구슬 <b>${b.orbs}</b> · 플레이 시간 <b>${time}</b>`,
      ].join('<br>'),
      panel,
    );
    const buttons = () => {
      const btns = this.ui.el('div', 'row', '', panel);
      btns.style.marginBottom = '0';
      return btns;
    };
    if (last) {
      markSeen('hiragana-clear');
      this.ui.el('p', 'result-next', '🎉 <b>히라가나를 모두 되찾았다!</b> 탁음 · 요음 · 작은 글자까지<br>다음 — <b>2부 · 항구 도시 미나토</b> <span class="jp">カタカナ</span> · 제작 중이에요', panel);
      this.ui.button('타이틀로', () => {
        clearSave();
        this.scene.start('Title');
      }, 'primary', buttons());
      return;
    }
    // 장을 깨면 새 무기가 열린다 (1장 오오누사 · 3장 텐구 부채)
    const gift: ArmsId | undefined = ({ 1: 'nusa', 3: 'uchiwa' } as Record<number, ArmsId>)[num];
    if (gift) {
      const def = ARSENAL[gift];
      unlockArms(gift);
      this.ui.el('p', 'result-gift', `${def.icon} 새 무기 <b>${def.name}</b> 해금 — ${def.desc}`, panel);
    }
    // 다음 장을 바로 저장해 두면 타이틀에서 '이어하기'로도 들어갈 수 있다
    const next = chapterDef(num + 1);
    this.ui.el('p', 'result-next', `다음 — <b>${num + 1}장 · ${next.title}</b> <span class="jp">${next.rows.map((r) => rowShort(r)).join(' · ')}</span><br><small>빌드는 새로 시작 · 되찾은 글자와 해금한 무기는 그대로</small>`, panel);
    newJourney(num + 1);
    saveJourney();
    const btns = buttons();
    this.ui.button(`${num + 1}장으로`, () => this.scene.start('ChapterMap'), 'primary', btns);
    this.ui.button('타이틀로', () => this.scene.start('Title'), '', btns);
  }
}

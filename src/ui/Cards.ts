import type { UILayer } from './UILayer';

export interface Card {
  icon: string;
  name: string;
  desc: string;
  /** 카드 아래 작은 글씨 (신 이름 등) */
  note?: string;
}

/**
 * 카드 n장 중 하나 고르기 (클릭 · 숫자키). 고른 번호로 끝난다.
 * 무기 강화 · 가호 · 보상 고르기에 같이 쓴다.
 */
export function pickCard(ui: UILayer, title: string, sub: string, cards: Card[]): Promise<number> {
  return new Promise((resolve) => {
    ui.root.classList.add('dimmed');
    const panel = ui.el('div', 'panel fade-in card-pick');
    ui.el('h2', '', title, panel);
    if (sub) ui.el('p', '', sub, panel);
    const row = ui.el('div', 'lvl-upgrades', '', panel);
    const done = (i: number) => {
      window.removeEventListener('keydown', onKey);
      panel.remove();
      ui.root.classList.remove('dimmed');
      resolve(i);
    };
    cards.forEach((c, i) => {
      const el = ui.el('button', 'ucard clickable', '', row);
      el.innerHTML = `<span class="uicon">${c.icon}</span><b>${c.name}</b><span>${c.desc}</span>${c.note ? `<em>${c.note}</em>` : ''}<small>${i + 1}</small>`;
      el.addEventListener('click', () => done(i));
    });
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.settings-panel')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= cards.length) done(n - 1);
    };
    window.addEventListener('keydown', onKey);
  });
}

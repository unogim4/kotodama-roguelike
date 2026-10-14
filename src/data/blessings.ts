/**
 * 가호 (패시브) — 신사 · 원한 요괴 · 찻집에서 얻는다. 한 판 동안 유지.
 * 신마다 성격이 다르다: 아마테라스(피해·빛) · 스사노오(넉백·범위) · 츠쿠요미(퀴즈 시간·무적) · 이나리(구슬·행운)
 */
export type GodId = 'amaterasu' | 'susanoo' | 'tsukuyomi' | 'inari';

/** 가호가 바꾸는 수치 (빌드에 저장) */
export interface Mods {
  /** 부적 피해 배율 */
  ofudaDmg: number;
  /** 강타 확률 더하기 */
  crit: number;
  /** 넉백 배율 */
  knockback: number;
  /** 여우불 개수 더하기 · 반경 배율 */
  foxCount: number;
  foxRange: number;
  /** 퀴즈 제한시간 더하기 (초) */
  quizTime: number;
  /** 피격 후 무적 시간 배율 */
  invuln: number;
  /** 언령 구슬 획득 배율 */
  orbGain: number;
  /** 강화 선택지 개수 더하기 */
  extraChoice: number;
  /** 혼백 구슬을 끌어오는 거리 배율 */
  magnet: number;
}

export function baseMods(): Mods {
  return { ofudaDmg: 1, crit: 0, knockback: 1, foxCount: 0, foxRange: 1, quizTime: 0, invuln: 1, orbGain: 1, extraChoice: 0, magnet: 1 };
}

export interface GodDef {
  id: GodId;
  name: string;
  icon: string;
  /** 기도할 때 들리는 한 마디 */
  voice: string;
}

export const GODS: Record<GodId, GodDef> = {
  amaterasu: { id: 'amaterasu', name: '아마테라스', icon: '☀️', voice: '빛을 두려워 말거라.' },
  susanoo: { id: 'susanoo', name: '스사노오', icon: '🌪️', voice: '하하! 바람에 실어 날려 버려라!' },
  tsukuyomi: { id: 'tsukuyomi', name: '츠쿠요미', icon: '🌙', voice: '……서두르지 마라. 달은 기다려 준다.' },
  inari: { id: 'inari', name: '이나리', icon: '🦊', voice: '후후, 우리 콘이 신세를 지고 있구나?' },
};

export interface Blessing {
  id: string;
  god: GodId;
  name: string;
  desc: string;
  apply: (m: Mods) => void;
}

export const BLESSINGS: Blessing[] = [
  { id: 'sun-ofuda', god: 'amaterasu', name: '햇살 부적', desc: '부적 피해 +25%', apply: (m) => (m.ofudaDmg += 0.25) },
  { id: 'sunrise', god: 'amaterasu', name: '해돋이', desc: '강타 확률 +10%', apply: (m) => (m.crit += 0.1) },
  { id: 'gale', god: 'susanoo', name: '거센 바람', desc: '넉백 +50%', apply: (m) => (m.knockback += 0.5) },
  { id: 'storm-fox', god: 'susanoo', name: '폭풍 여우불', desc: '여우불 +1개 · 반경 +20%', apply: (m) => ((m.foxCount += 1), (m.foxRange += 0.2)) },
  { id: 'moon-calm', god: 'tsukuyomi', name: '달의 고요', desc: '퀴즈 제한시간 +3초', apply: (m) => (m.quizTime += 3) },
  { id: 'moon-shadow', god: 'tsukuyomi', name: '달그림자', desc: '맞은 뒤 무적 시간 +50%', apply: (m) => (m.invuln += 0.5) },
  { id: 'harvest', god: 'inari', name: '풍년', desc: '언령 구슬 획득 +50%', apply: (m) => (m.orbGain += 0.5) },
  { id: 'fox-luck', god: 'inari', name: '여우의 행운', desc: '강화 선택지 3개 → 4개', apply: (m) => (m.extraChoice += 1) },
];

export function blessing(id: string): Blessing | undefined {
  return BLESSINGS.find((b) => b.id === id);
}

/**
 * 가호 3택: 서로 다른 신 셋이 아직 받지 않은 가호를 하나씩 내민다.
 * (남은 가호가 모자라면 있는 만큼)
 */
export function rollBlessings(owned: string[], n = 3): Blessing[] {
  const free = BLESSINGS.filter((b) => !owned.includes(b.id));
  const gods = [...new Set(free.map((b) => b.god))].sort(() => Math.random() - 0.5).slice(0, n);
  return gods.map((g) => {
    const list = free.filter((b) => b.god === g);
    return list[Math.floor(Math.random() * list.length)];
  });
}

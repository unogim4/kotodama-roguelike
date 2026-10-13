import type { ArmsId } from '../data/arsenal';

/**
 * 판을 넘어 영구히 남는 기록 (스토리로 해금한 무기 · 본 이야기).
 * 여정 저장(save.ts)과 따로 둔다 — 새 이야기를 시작해도 남는다.
 */
const KEY = 'kotodama-main-profile';

export const profile = {
  /** 스토리로 해금해 레벨업 선택지에 나올 수 있는 무기 */
  unlockedArms: ['ofuda', 'hamayumi', 'naginata'] as ArmsId[],
  /** 이미 본 이야기 (다시 볼 때 건너뛰기 허용) */
  seen: [] as string[],
};

export function loadProfile(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Partial<typeof profile>;
    // 처음부터 열린 무기(부적 · 하마유미 · 나기나타)는 늘 포함
    if (Array.isArray(d.unlockedArms)) profile.unlockedArms = [...new Set<ArmsId>(['ofuda', 'hamayumi', 'naginata', ...d.unlockedArms])];
    if (Array.isArray(d.seen)) profile.seen = d.seen;
  } catch {
    /* 읽을 수 없으면 처음 상태로 */
  }
}

export function saveProfile(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* 저장 불가 — 무시 */
  }
}

export function clearProfile(): void {
  profile.unlockedArms = ['ofuda', 'hamayumi', 'naginata'];
  profile.seen = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}

export function markSeen(id: string): void {
  if (!profile.seen.includes(id)) profile.seen.push(id);
  saveProfile();
}

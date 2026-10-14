/** 사용자 설정 (개발·테스트용). 브라우저에 기억해 둔다 */
export const settings = {
  /** 무적: 피해를 받지 않는다 (연출은 그대로) */
  god: false,
  /** 효과음 크기 (0 = 끔) */
  sfx: 0.6,
};

const KEY = 'kotodama-main-settings';

export function loadSettings(): void {
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    // 저장소를 못 쓰는 환경이면 기본값
  }
}

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 무시
  }
}

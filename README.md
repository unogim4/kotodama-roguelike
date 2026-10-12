# 언령(言霊) — 문자가 사라진 세계

한국인 학습자를 위한 **히라가나·카타카나 학습 로그라이크** (본편 개발 중).
글자를 먹는 대요괴 모지쿠이에게 문자를 빼앗긴 세계에서, 견습 언령사 코토하가 글자를 하나씩 되찾는다.
끝까지 플레이하면 가나가 **보는 즉시 읽히는** 상태가 되는 것이 목표.

- 참고 게임: Hades, Vampire Survivors
- 프로토타입(히라가나 10행 챕터)은 [kotodama-prototype](https://github.com/unogim4/kotodama-prototype)에 보관

## 바로 플레이 (개발 중)

👉 **https://unogim4.github.io/kotodama-roguelike/** (main에 푸시하면 자동 배포)

- 🗺️ 1장 지역 맵: [#map](https://unogim4.github.io/kotodama-roguelike/#map) — 가로 두루마리 지도 · 갈림길 · 간판 복원 · **1장 전체를 처음부터 끝까지 플레이** (프롤로그 → 지도 → 야마비코 → 엔딩 · 결과) (나머지 노드는 제작 중)
- ⛩️ 서고: [#library](https://unogim4.github.io/kotodama-roguelike/#library) · 👹 습격: [#raid](https://unogim4.github.io/kotodama-roguelike/#raid) · 📜 콘: [#kon](https://unogim4.github.io/kotodama-roguelike/#kon) · 🏚️ 프롤로그: [#prologue](https://unogim4.github.io/kotodama-roguelike/#prologue) · 👺 보스: [#boss](https://unogim4.github.io/kotodama-roguelike/#boss) · 🌄 엔딩: [#ending](https://unogim4.github.io/kotodama-roguelike/#ending) — 단독 미리보기
- 🧪 전투 샘플: [#sandbox](https://unogim4.github.io/kotodama-roguelike/#sandbox) — 32px 도트 · 다중 무기 · 타격감
- 🧪 보스 시험장: [#bosslab](https://unogim4.github.io/kotodama-roguelike/#bosslab) — 보스 피지컬 패턴 9종

## 문서
- [본편기획서.md](본편기획서.md) — 학습 설계 · 지역 맵 · 언령술/가호/무기 진화 · 결정 로그
- [스토리.md](스토리.md) — 인물 · 1부 히라가나 · 2부 카타카나 · 최종장 · 마지막 언령
- [제작도.md](제작도.md) — 진행 현황 트리
- [개발일지.md](개발일지.md) — 날짜별 작업 기록

## 실행

```bash
npm install
npm run dev
```

일본어 음성(TTS)은 **Edge**(Nanami) 또는 **Chrome**에서 가장 잘 나온다. F2 = 사용자 설정(장면 이동 · 무적).

## 기술
- Phaser 3 + TypeScript + Vite, 640×360 정수배 확대
- 도트는 코드로 찍는다 (`src/art/hd` — 자동 외곽선 격자), 학습 글자는 교과서체(Klee One), UI는 Galmuri

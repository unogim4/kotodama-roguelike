# 언령(言霊) — 문자가 사라진 세계

한국인 학습자를 위한 **히라가나·카타카나 학습 로그라이크** (본편 개발 중).
글자를 먹는 대요괴 모지쿠이에게 문자를 빼앗긴 세계에서, 견습 언령사 코토하가 글자를 하나씩 되찾는다.
끝까지 플레이하면 가나가 **보는 즉시 읽히는** 상태가 되는 것이 목표.

- 참고 게임: Hades, Vampire Survivors
- 프로토타입(히라가나 10행 챕터)은 [kotodama-prototype](https://github.com/unogim4/kotodama-prototype)에 보관

## 바로 플레이 (개발 중)

👉 **https://unogim4.github.io/kotodama-roguelike/** (main에 푸시하면 자동 배포)

- 🗺️ 지역 맵: [#map](https://unogim4.github.io/kotodama-roguelike/#map) — 가로 두루마리 지도 · 갈림길 · 간판 복원 · **1부 히라가나 1~4장을 처음부터 끝까지 플레이** (프롤로그 → 1장 야마비코 → 2장 갓파 → 3장 텐구 → 4장 오니 → 히라가나 완주)
- ⛩️ 서고: [#library](https://unogim4.github.io/kotodama-roguelike/#library) · 👹 습격: [#raid](https://unogim4.github.io/kotodama-roguelike/#raid) · 📜 콘: [#kon](https://unogim4.github.io/kotodama-roguelike/#kon) · 🏚️ 프롤로그: [#prologue](https://unogim4.github.io/kotodama-roguelike/#prologue) · 👺 보스: [#boss](https://unogim4.github.io/kotodama-roguelike/#boss) · 🌄 엔딩: [#ending](https://unogim4.github.io/kotodama-roguelike/#ending) — 단독 미리보기
- 🧪 전투 샘플: [#sandbox](https://unogim4.github.io/kotodama-roguelike/#sandbox) — 32px 도트 · 다중 무기 · 타격감
- 🧪 보스 시험장: [#bosslab](https://unogim4.github.io/kotodama-roguelike/#bosslab) — 보스 피지컬 패턴 9종
- 🎨 아트 시험장: [#artlab](https://unogim4.github.io/kotodama-roguelike/#artlab) — 2세대 세밀 도트 샘플 (옛 그림 비교 · M 움직여 보기: WASD · 마우스 조준 · 1/2/3 무기 · Space 돌진)

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

## 사용한 에셋
- [Ninja Adventure Asset Pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by pixel-boy — **CC0** (`public/assets/ninja/`: 바닥 장식 · 입자 일부)
- 그 밖의 도트 · 효과음은 모두 코드로 그리고 합성

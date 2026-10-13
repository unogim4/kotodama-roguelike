export interface Kana {
  /** 히라가나 */
  kana: string;
  /** 로마자 표기 */
  romaji: string;
  /** 한글 발음 (퀴즈 정답) */
  ko: string;
  /** 한글 입력에서 함께 인정하는 발음 */
  alt?: string[];
  /** 서고에서 보여주는 발음 팁 */
  tip?: string;
  /** 한글 한 음절로 입력할 수 없는 글자 (ん) — 입력 문제에서 제외 */
  noType?: boolean;
}

export interface Row {
  /** 0부터 */
  index: number;
  /** 'あ행' */
  name: string;
  /** 지도 · 칩에 쓰는 짧은 이름 (あ · が …) */
  short?: string;
  kana: Kana[];
  /** 글자가 많은 구간(4장)은 서고에서 묶음 두루마리로 펼친다 */
  groups?: { name: string; kana: Kana[] }[];
}

const k = (kana: string, romaji: string, ko: string, extra: Partial<Kana> = {}): Kana => ({ kana, romaji, ko, ...extra });

/** 묶음 구간 (4장): 이름 · 짧은 이름 · 묶음들 → 한 행 */
function grouped(name: string, short: string, groups: [string, Kana[]][]): Omit<Row, 'index'> {
  return { name, short, kana: groups.flatMap(([, ks]) => ks), groups: groups.map(([n, ks]) => ({ name: n, kana: ks })) };
}

/** 기본 히라가나 46자, 10행 */
export const ROWS: Row[] = [
  { name: 'あ행', kana: [k('あ', 'a', '아'), k('い', 'i', '이'), k('う', 'u', '우', { tip: '입술을 둥글게 내밀지 않는 "우" — "으"에 가까워요' }), k('え', 'e', '에'), k('お', 'o', '오')] },
  { name: 'か행', kana: [k('か', 'ka', '카'), k('き', 'ki', '키'), k('く', 'ku', '쿠'), k('け', 'ke', '케'), k('こ', 'ko', '코')] },
  { name: 'さ행', kana: [k('さ', 'sa', '사'), k('し', 'shi', '시', { tip: '"si"가 아니라 "shi" — 혀를 살짝 뒤로 당긴 "시"' }), k('す', 'su', '스'), k('せ', 'se', '세'), k('そ', 'so', '소')] },
  {
    name: 'た행',
    kana: [
      k('た', 'ta', '타'),
      k('ち', 'chi', '치', { tip: '"ti"가 아니라 "chi" — 우리말 "치"와 비슷해요' }),
      k('つ', 'tsu', '츠', { alt: ['쓰'], tip: '"츠"와 "쓰" 사이 — 혀끝을 윗니 뒤에 대고 "ㅊ"' }),
      k('て', 'te', '테'),
      k('と', 'to', '토'),
    ],
  },
  { name: 'な행', kana: [k('な', 'na', '나'), k('に', 'ni', '니'), k('ぬ', 'nu', '누'), k('ね', 'ne', '네'), k('の', 'no', '노')] },
  {
    name: 'は행',
    kana: [
      k('は', 'ha', '하', { tip: '조사로 쓸 때는 "와"로 읽어요 (こんにちは)' }),
      k('ひ', 'hi', '히'),
      k('ふ', 'fu', '후', { tip: '입술을 살짝만 모으고 바람을 내보내는 "후"' }),
      k('へ', 'he', '헤', { tip: '조사로 쓸 때는 "에"로 읽어요' }),
      k('ほ', 'ho', '호'),
    ],
  },
  { name: 'ま행', kana: [k('ま', 'ma', '마'), k('み', 'mi', '미'), k('む', 'mu', '무'), k('め', 'me', '메'), k('も', 'mo', '모')] },
  { name: 'や행', kana: [k('や', 'ya', '야'), k('ゆ', 'yu', '유'), k('よ', 'yo', '요')] },
  { name: 'ら행', kana: [k('ら', 'ra', '라'), k('り', 'ri', '리'), k('る', 'ru', '루'), k('れ', 're', '레'), k('ろ', 'ro', '로')] },
  {
    name: 'わ행',
    kana: [
      k('わ', 'wa', '와'),
      k('を', 'wo', '오', { tip: 'お와 같은 "오" — 조사 "~을/를"로만 써요' }),
      k('ん', 'n', '응', { noType: true, tip: '혼자서는 음절이 안 되는 받침 소리 — 뒤 글자에 따라 ㄴ·ㅁ·ㅇ' }),
    ],
  },
  // ── 4장 · 옛 도성: 탁음 · 반탁음 · 요음 · 촉음/장음 (구간마다 한 '행'으로 다룬다) ──
  grouped('탁음', 'が', [
    ['が행', [k('が', 'ga', '가'), k('ぎ', 'gi', '기'), k('ぐ', 'gu', '구'), k('げ', 'ge', '게'), k('ご', 'go', '고')]],
    ['ざ행', [k('ざ', 'za', '자'), k('じ', 'ji', '지'), k('ず', 'zu', '즈'), k('ぜ', 'ze', '제'), k('ぞ', 'zo', '조')]],
    [
      'だ행',
      [
        k('だ', 'da', '다'),
        k('ぢ', 'ji', '지', { tip: 'じ와 같은 소리 — 거의 쓰지 않아요' }),
        k('づ', 'zu', '즈', { tip: 'ず와 같은 소리 — 거의 쓰지 않아요' }),
        k('で', 'de', '데'),
        k('ど', 'do', '도'),
      ],
    ],
    ['ば행', [k('ば', 'ba', '바'), k('び', 'bi', '비'), k('ぶ', 'bu', '부'), k('べ', 'be', '베'), k('ぼ', 'bo', '보')]],
  ]),
  grouped('반탁음', 'ぱ', [['ぱ행', [k('ぱ', 'pa', '파', { tip: '동그라미(゜)가 붙으면 ㅍ 소리' }), k('ぴ', 'pi', '피'), k('ぷ', 'pu', '푸'), k('ぺ', 'pe', '페'), k('ぽ', 'po', '포')]]]),
  grouped('요음', 'ゃ', [
    ['きゃ·しゃ·ちゃ', [k('きゃ', 'kya', '캬', { tip: 'き + 작은 ゃ — 두 글자를 한 소리로' }), k('きゅ', 'kyu', '큐'), k('きょ', 'kyo', '쿄'), k('しゃ', 'sha', '샤'), k('しゅ', 'shu', '슈'), k('しょ', 'sho', '쇼'), k('ちゃ', 'cha', '차'), k('ちゅ', 'chu', '추'), k('ちょ', 'cho', '초')]],
    ['にゃ·ひゃ·みゃ', [k('にゃ', 'nya', '냐'), k('にゅ', 'nyu', '뉴'), k('にょ', 'nyo', '뇨'), k('ひゃ', 'hya', '햐'), k('ひゅ', 'hyu', '휴'), k('ひょ', 'hyo', '효'), k('みゃ', 'mya', '먀'), k('みゅ', 'myu', '뮤'), k('みょ', 'myo', '묘')]],
    ['りゃ·ぎゃ·じゃ', [k('りゃ', 'rya', '랴'), k('りゅ', 'ryu', '류'), k('りょ', 'ryo', '료'), k('ぎゃ', 'gya', '갸'), k('ぎゅ', 'gyu', '규'), k('ぎょ', 'gyo', '교'), k('じゃ', 'ja', '자', { alt: ['쟈'] }), k('じゅ', 'ju', '주', { alt: ['쥬'] }), k('じょ', 'jo', '조', { alt: ['죠'] })]],
    ['びゃ·ぴゃ', [k('びゃ', 'bya', '뱌'), k('びゅ', 'byu', '뷰'), k('びょ', 'byo', '뵤'), k('ぴゃ', 'pya', '퍄'), k('ぴゅ', 'pyu', '퓨'), k('ぴょ', 'pyo', '표')]],
  ]),
  // 촉음(っ) · 장음은 낱글자가 아니라 단어로 익힌다 (읽기 고르기만)
  grouped('촉음·장음', 'っ', [
    [
      '작은 っ',
      [
        k('きって', 'kitte', '킷테', { noType: true, tip: '작은 っ는 다음 소리 앞에서 한 박자 멈춤 — 우표' }),
        k('がっこう', 'gakkou', '갓코-', { noType: true, tip: 'っ에서 멈추고, こう는 "코-" 길게 — 학교' }),
        k('ざっし', 'zasshi', '잣시', { noType: true, tip: '잡지' }),
      ],
    ],
    [
      '길게 읽기',
      [
        k('おかあさん', 'okaasan', '오카-상', { noType: true, tip: 'かあ — 같은 모음이 이어지면 길게 — 어머니' }),
        k('おにいさん', 'oniisan', '오니-상', { noType: true, tip: 'にい — 길게 — 형 · 오빠' }),
        k('せんせい', 'sensei', '센세-', { noType: true, tip: 'えい는 "에-"처럼 길게 — 선생님' }),
      ],
    ],
  ]),
].map((r, index) => ({ ...r, index }));

/** あ행 (예전 코드 호환) */
export const ROW_A = ROWS[0].kana;

export const ALL_KANA: Kana[] = ROWS.flatMap((r) => r.kana);

export function findKana(kana: string): Kana | undefined {
  return ALL_KANA.find((x) => x.kana === kana);
}

/** 한글 입력이 정답인지 (대체 발음 포함) */
export function matchesKo(k: Kana, typed: string): boolean {
  return typed === k.ko || (k.alt ?? []).includes(typed);
}

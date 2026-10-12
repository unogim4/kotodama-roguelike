import { journey, Build, newBuild } from './journey';
import { run } from './run';
import { profile } from './profile';
import type { MapNode } from '../map/nodes';

/**
 * 💾 자동 저장 1칸 (브라우저 localStorage).
 * 지도에 돌아올 때마다 저장한다 → 장면 도중에 끄면 그 노드에 들어가기 직전 지도에서 이어진다.
 * PC·모바일로 옮길 때는 storage만 파일 저장으로 바꾸면 된다.
 */
const KEY = 'kotodama-main-save';
const VERSION = 1;

interface SaveData {
  v: number;
  savedAt: number;
  chapter: number;
  seed: number;
  /** 지도 생성기가 바뀌어도 같은 지도로 이어지도록 노드를 그대로 저장 */
  nodes: MapNode[];
  current: number;
  visited: number[];
  learnedRows: number[];
  checkpoint: number;
  build: Build;
  wrong: Record<string, number>;
}

const storage = {
  get: (): string | null => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (s: string): void => {
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* 저장 불가 (사생활 보호 모드 등) — 조용히 넘어간다 */
    }
  },
  clear: (): void => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
  },
};

export function saveJourney(): void {
  if (journey.nodes.length === 0) return;
  const data: SaveData = {
    v: VERSION,
    savedAt: Date.now(),
    chapter: journey.chapter,
    seed: journey.seed,
    nodes: journey.nodes,
    current: journey.current,
    visited: journey.visited,
    learnedRows: journey.learnedRows,
    checkpoint: journey.checkpoint,
    build: journey.build,
    wrong: run.wrong,
  };
  storage.set(JSON.stringify(data));
}

function read(): SaveData | null {
  const raw = storage.get();
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as SaveData;
    if (d.v !== VERSION || !Array.isArray(d.nodes) || d.nodes.length === 0 || !d.nodes[d.current]) return null;
    return d;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return read() !== null;
}

/** 저장된 여정을 불러온다. 없거나 깨졌으면 false */
export function loadJourney(): boolean {
  const d = read();
  if (!d) return false;
  journey.chapter = d.chapter;
  journey.seed = d.seed;
  journey.nodes = d.nodes;
  journey.current = d.current;
  journey.visited = d.visited;
  journey.learnedRows = d.learnedRows;
  journey.checkpoint = d.checkpoint;
  // 나중에 빌드 항목이 늘어도 옛 저장이 깨지지 않게 기본값 위에 덮는다
  journey.build = { ...newBuild(), ...d.build };
  journey.build.unlocked = [...new Set([...journey.build.unlocked, ...profile.unlockedArms])];
  journey.pending = null;
  journey.fallen = false;
  run.wrong = d.wrong ?? {};
  return true;
}

export interface SaveSummary {
  chapter: number;
  /** 지금 서 있는 노드의 가로 위치 (지역 이름용) */
  x: number;
  learnedRows: number[];
  level: number;
  hp: number;
  maxHp: number;
  orbs: number;
  savedAt: number;
}

export function saveSummary(): SaveSummary | null {
  const d = read();
  if (!d) return null;
  return {
    chapter: d.chapter,
    x: d.nodes[d.current].x,
    learnedRows: d.learnedRows,
    level: d.build.level,
    hp: d.build.hp,
    maxHp: d.build.maxHp,
    orbs: d.build.orbs,
    savedAt: d.savedAt,
  };
}

export function clearSave(): void {
  storage.clear();
}

import { generateChapter1 } from '../map/chapter1';
import type { MapNode } from '../map/nodes';
import type { ArmsId, Owned } from '../data/arsenal';
import { run } from './run';

/**
 * 한 판 동안 이어지는 빌드 (하데스처럼 장 하나 내내 유지).
 * 체력은 온천 · 쉼터 · 찻집에서만 회복되고, 쓰러지면 처음으로 돌아간다.
 */
export interface Build {
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  /** 이동 속도 배율 */
  speed: number;
  /** 장착한 무기 (최대 4칸) */
  owned: Owned[];
  /** 스토리로 해금해 레벨업 선택지에 나올 수 있는 무기 */
  unlocked: ArmsId[];
  /** 언령 구슬 (찻집에서 쓴다) */
  orbs: number;
}

export function newBuild(): Build {
  return { level: 1, xp: 0, hp: 100, maxHp: 100, speed: 1, owned: [{ id: 'ofuda', level: 1 }], unlocked: ['ofuda'], orbs: 0 };
}

/**
 * 지역 지도 위의 여정 (한 챕터 한 판).
 * 저장·이어하기는 다음 단계에서 이 객체를 그대로 저장한다.
 */
export const journey = {
  chapter: 1,
  seed: 0,
  nodes: [] as MapNode[],
  /** 지금 서 있는 노드 */
  current: 0,
  visited: [] as number[],
  /** 되찾은 행 (0 = あ, 1 = か, 2 = さ) */
  learnedRows: [] as number[],
  /** 마지막으로 통과한 시련 (쓰러지면 여기부터) */
  checkpoint: -1,
  build: newBuild(),
  /** 장면(서고·습격 …)을 마치고 지도로 돌아올 때 완료 처리할 노드 */
  pending: null as number | null,
  /** 쓰러져서 체크포인트로 돌아왔다는 표시 (지도에서 한 번 안내) */
  fallen: false,
};

export function newJourney(seed = Math.floor(Math.random() * 1e9)): void {
  journey.seed = seed;
  journey.nodes = generateChapter1(seed);
  journey.current = 0;
  journey.visited = [0];
  journey.learnedRows = [];
  journey.checkpoint = -1;
  journey.build = newBuild();
  journey.pending = null;
  journey.fallen = false;
  run.wrong = {};
}

/** 노드 장면에 들어가기 전: 퀴즈 범위를 그 노드의 행으로 맞춘다 */
export function enterNode(node: MapNode): void {
  run.chapter = node.row;
}

/** 노드 장면을 마쳤다 → 지도로 돌아가면 완료 처리 */
export function finishNode(id: number): void {
  journey.pending = id;
}

/**
 * 쓰러졌다 → 마지막 시련 지점부터 (빌드는 초기화, 되찾은 글자는 유지).
 * 시련을 하나도 넘지 못했다면 처음 자리로.
 */
export function fallToCheckpoint(): void {
  const back = journey.checkpoint >= 0 ? journey.checkpoint : 0;
  const i = journey.visited.indexOf(back);
  journey.visited = i >= 0 ? journey.visited.slice(0, i + 1) : [back];
  journey.current = back;
  journey.build = newBuild();
  journey.pending = null;
  journey.fallen = true;
}

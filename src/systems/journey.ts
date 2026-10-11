import { generateChapter1 } from '../map/chapter1';
import type { MapNode } from '../map/nodes';

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
};

export function newJourney(seed = Math.floor(Math.random() * 1e9)): void {
  journey.seed = seed;
  journey.nodes = generateChapter1(seed);
  journey.current = 0;
  journey.visited = [0];
  journey.learnedRows = [];
  journey.checkpoint = -1;
}

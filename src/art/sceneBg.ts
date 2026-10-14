import { settings } from '../systems/settings';
import { packReady } from './pack/tiles';
import { packLibraryRoom, packVisit, packAlley, packYard } from './pack/packScenes';
import { libraryRoom } from './hd/library';
import { visitBackground, VisitKind } from './hd/visit';
import { alleyBackground, ShopKind } from './hd/alley';
import { shrineYard } from './hd/prologue';
import { chapter1World } from './hd/worldMap';
import { themedWorld } from './hd/themeMap';
import { packChapter1World, packThemedWorld } from './pack/packWorld';
import type { ChapterDef } from '../data/chapters';

/**
 * 🖼️ 이야기 장면 배경 고르기 — 배경 설정이 '팩'이면 Ninja Adventure 타일 그림, '코드'면 직접 그린 도트.
 * 텍스처 키에 '-pack'을 붙여 두 그림이 함께 있어도 섞이지 않게.
 */
export const usePackBg = (): boolean => settings.bg === 'pack' && packReady();
export const bgKey = (base: string): string => (usePackBg() ? `${base}-pack` : base);

export const libraryBg = (): HTMLCanvasElement => (usePackBg() ? packLibraryRoom() : libraryRoom());
export const alleyBg = (order: ShopKind[]): HTMLCanvasElement => (usePackBg() ? packAlley(order) : alleyBackground(order));
export const visitBg = (kind: VisitKind): HTMLCanvasElement => (usePackBg() ? packVisit(kind, () => packAlley(['kaki', 'okaki', 'ika', 'eki'])) : visitBackground(kind));
export const yardBg = (): HTMLCanvasElement => (usePackBg() ? packYard() : shrineYard());

/** 장 지도 (1장은 따로 그린 지도 · 2~4장은 테마 지도) */
export const worldBg = (def: ChapterDef, W: number): HTMLCanvasElement =>
  usePackBg() ? (def.num === 1 ? packChapter1World() : packThemedWorld(def, W)) : def.num === 1 ? chapter1World() : themedWorld(def, W);

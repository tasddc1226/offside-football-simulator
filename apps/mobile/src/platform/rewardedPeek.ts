// 1.0.2 호환 번들: 이 빌드에는 AdMob 네이티브 모듈이 없어 보상형 광고로 잠재력 보기를 숨긴다.
import { proxy } from 'valtio';
import type { PotentialPeek } from '@offside/app-core/potential-peek';
import type { GameState } from '@offside/game/types';

export const potPeek = proxy({ peek: null as PotentialPeek | null, busy: false, message: '' });
export const peekAvailable = () => false;
export async function openPeek(_: GameState) {}

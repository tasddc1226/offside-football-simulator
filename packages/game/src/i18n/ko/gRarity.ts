// 칭호 등급 이름(titles.ts RARITY_LABEL). 키가 등급 숫자라 그 객체가 이 네임스페이스를 그대로 쓴다.
import { ns } from '@offside/contracts/i18n';

const ko = { 1: '일반', 2: '희귀', 3: '영웅', 4: '전설' };
export type GRarityMsgs = typeof ko;
export const gRarityText = ns('gRarity', ko);

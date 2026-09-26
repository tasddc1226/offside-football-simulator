// 포지션 이름과 익명 선수 표기. 워커(공유 링크 미리보기)도 쓰므로 게임 데이터를 끌어오지 않는 작은 모듈로 둔다.
// 이름은 game/data.ts POS의 label과 같다(share-meta.test.ts가 맞춰 본다).
import type { Pos } from './data.js';

export const POS_LABEL: Record<Pos, string> = { FW: '공격수', MF: '미드필더', DF: '수비수', GK: '골키퍼' };

/** 이름을 공개하지 않은 선수 표기(명예의 전당·서버 최초 기록·공유 링크 미리보기). */
export function anonName(pos: Pos, number: number | null): string {
  return `익명의 ${POS_LABEL[pos]}${number != null ? ` No.${number}` : ''}`;
}

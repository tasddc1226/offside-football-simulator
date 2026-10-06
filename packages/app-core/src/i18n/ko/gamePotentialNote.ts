// gamePotential 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  notice: '잠재력 평가는 은퇴할 때 공개돼요.',
  retirementNote:
    '은퇴 시점의 성장 기준값이에요. 최대 OVR을 뜻하지 않아 최고 OVR이 이 값을 넘을 수 있어요.',
};

export type GamePotentialNoteMsgs = typeof ko;
export const gamePotentialNoteText = ns('gamePotentialNote', ko);

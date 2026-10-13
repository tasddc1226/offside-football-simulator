// T-11-191 웹·앱 전체 화면 로딩에서 공유하는 제자리 모션 순서. 게임 RNG와 무관하다.
import { MOTIONS, type MotionId } from '@offside/game/avatar-motion';

export interface StageBeat {
  motion: MotionId;
  flip: boolean;
  ms: number;
  step: number;
}

const cycle = (id: MotionId) => MOTIONS[id].frames.reduce((t, f) => t + f.ms, 0);

/** 짧은 프리시즌에도 달리기→슈팅을 보여 주며 캐릭터 위치는 화면 중앙에 고정한다. */
export const progressBeat = (step = 0): StageBeat => {
  const beats: Omit<StageBeat, 'step'>[] = [
    { motion: 'idle', flip: false, ms: 120 },
    { motion: 'run', flip: false, ms: 600 },
    { motion: 'shoot', flip: false, ms: cycle('shoot') },
    { motion: 'dribble', flip: true, ms: 900 },
    { motion: 'juggle', flip: false, ms: cycle('juggle') * 2 },
    { motion: 'run', flip: false, ms: 700 },
    { motion: 'header', flip: false, ms: cycle('header') },
  ];
  return { ...beats[step % beats.length]!, step };
};

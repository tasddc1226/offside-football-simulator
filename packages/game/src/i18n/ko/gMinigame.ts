// 원터치 미니게임(game/minigame.ts)의 탭 버튼·구간 크기·결과 한 줄.
import { ns } from '@offside/contracts/i18n';

const ko = {
  tapShot: '슛!',
  tapChip: '칩슛!',
  tapDribble: '제친다!',
  tapSave: '다이빙!',
  zoneWide: '넓음',
  zoneMedium: '보통',
  zoneNarrow: '좁음',
  timeout: (p: { sec: number }) => `시간 초과. ${p.sec}초 안에 누르지 않았어요`,
  perfect: '완벽한 타이밍!',
  good: '타이밍 성공',
  close: '아깝게 빗나간 타이밍',
  miss: '타이밍을 놓쳤어요',
};
export type GMinigameMsgs = typeof ko;
export const gMinigameText = ns('gMinigame', ko);

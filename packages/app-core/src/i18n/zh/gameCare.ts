import type { Translation } from '../core';
import type { GameCareMsgs } from '../ko/gameCare';

export const gameCare: Translation<GameCareMsgs> = {
  title: '狀態管理',
  tier1: '基本護理',
  tier2: '密集護理',
  tier3: '專屬醫療團隊',
  lineOpen: '本賽季結束後能力會下降。接受狀態管理可以減少下降幅度。',
  lineDone: (p) => `本賽季已接受${p.name}。賽季結束時的下降會減少${p.cut}%。`,
  option: (p) => `下降減少${p.cut}%`,
  short: '資金不足',
  confirm: (p) => `要花費${p.cost}進行${p.name}。只對本賽季結束時的下降有效，無法取消。`,
  confirmBtn: '接受',
  cancel: '取消',
  note: '每個賽季可接受一次。離巔峰年齡越遠，費用越高。',
  done: (p) => `已開始${p.name}。`,
};

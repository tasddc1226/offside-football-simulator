import type { Translation } from '../core';
import type { SeasonGaugeMsgs } from '../ko/seasonGauge';

export const seasonGauge: Translation<SeasonGaugeMsgs> = {
  title: (p) => `${p.season} 進度`,
  aria: (p) => `${p.season} 進度 ${p.pct}%`,
  endsIn: (p) => `距離賽季結束 ${p.left}`,
  ended: '賽季已結束，正在整理結算。',
  days: (p) => `${p.d} 天 ${p.h} 小時`,
  hours: (p) => `${p.h} 小時 ${p.m} 分`,
  minutes: (p) => `${p.m} 分`,
  date: (p) => `${p.m}月${p.d}日（${'日一二三四五六'[p.w]}）`,
  endsOn: (p) => `開放至 ${p.date}`,
  endsBy: (p) => `最晚開放至 ${p.date}`,
  endsBetween: (p) => `最快至 ${p.from}，最晚開放至 ${p.to}`,
  why: (p) => `${p.n} 人正在一起推進。參與者增加，目標也會跟著變大。`,
  openLabel: (p) => `${p.aria}。查看賽季進度說明`,
  infoTitle: '賽季進度',
  infoWhatHead: '服務賽季',
  infoWhat:
    '紀錄室的排名與紀錄會按服務賽季分開統計。賽季長度不以日期決定，而是由大家一起推進的這條進度條決定。',
  infoFillHead: '推進進度條的方式',
  infoFill: (p) =>
    `球員踢到 ${p.age} 歲以上後退役的生涯會推進進度條。每人每天最多計入 ${p.cap} 個生涯。目標是每位至少完成過一個退役生涯的參與者 ${p.per} 個，所以參與者增加，目標也會跟著變大。`,
  infoEndHead: '截止',
  infoEnd: (p) =>
    `進度條達到 ${p.lock}% 時會決定截止時間並顯示剩餘時間。一個賽季最短 ${p.min} 天、最長 ${p.max} 天。若聯賽或 OFFSIDE 盃尚未結束，會延續到最後一場比賽隔天 0 時（韓國時間）。截止時間一到，下個賽季隨即開始。`,
  infoCareerHead: '進行中的生涯',
  infoCareer:
    '賽季結束後，進行中的生涯仍可繼續。球員屬於首個賽季紀錄上傳到伺服器時的賽季，即使下個賽季開始也不會改變。賽季結算的排名徽章與完賽紀錄，只計入截止前退役的球員。',
  infoWhereHead: '獎勵與成就',
  infoWhere:
    '賽季結算與紀錄徽章可在我的俱樂部榮譽館查看，成就則在我的球隊的成就選單查看。新賽季要重新建立老闆球隊，球員卡、俱樂部資金與道具都會保留。',
  infoClose: '關閉',
};

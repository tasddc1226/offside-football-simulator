import type { Translation } from '../core';
import type { FairnessMsgs } from '../ko/fairness';

export const fairness: Translation<FairnessMsgs> = {
  title: '機率與公平性',
  intro: '條件相同時，所有玩家都適用相同的規則與機率。下方數字直接由遊戲程式中的數值計算而來。',
  promiseSameTerm: '相同規則',
  promiseSame:
    '觀看廣告、購買移除廣告、綁定帳號、語言設定都不會影響機率。資金不足的賽季可以用廣告或俱樂部資金多挑戰一次潛力強化，但成功機率相同。唯一會改變機率的付費道具是高級球探券，改變後的機率全部公開在下方。',
  promiseDeviceTerm: '在裝置上判定',
  promiseDevice: '所有生涯判定都在這台裝置上進行。伺服器不決定結果，只接收紀錄。',
  promiseShownTerm: '顯示的機率就是實際機率',
  promiseShown: '選項上顯示的百分比就是實際成功機率。只有時機量表的選項會依指針停下的位置判定。',
  promiseVersionTerm: '以版本調整',
  promiseVersion:
    '營運期間調整數值時，會以版本為所有玩家套用相同數值。進行中的生涯從下個賽季開始變更。',
  potTitle: '潛力等級機率',
  potNote: '新球員的真實潛力依此機率決定。透過廣告查看等級範圍也不會改變結果。',
  gradeHead: '等級',
  colSeason: '賽季中開始',
  colPre: '季前賽開始',
  atLeastOne: (p) =>
    `3 名候選中出現至少 1 名${p.grade}級的機率：賽季中${p.season}，季前賽${p.pre}。`,
  premium: (p) =>
    `使用高級球探券挑選時，3 名候選中保證 1 名 A 級以上。所有候選出現 S 的機率是一般的${p.mult}倍，賽季中${p.season}，季前賽${p.pre}。其餘候選的 A～D 維持上表比例。`,
  premiumPity: (p) =>
    `保底：連續使用${p.sure - 1}張高級球探券都沒出現 S 候選時，第${p.sure}張的保證候選必定為 S。途中出現 S 候選就重新計算。每累計第${p.elite}張，保證候選的潛力必定為最高值（96）。剩餘張數可在候選選擇畫面查看。`,
  rerollMileage: (p) =>
    `重抽券不會改變候選的潛力機率。但每使用${p.need}張重抽券可獲得 1 張高級球探券。透過廣告重抽不計入。`,
  boostTitle: '潛力強化機率',
  boostLv: (p) => `+${p.lv}階段`,
  boostNote: (p) =>
    `在同一階段每失敗一次，下次挑戰的機率提高${p.pity}。用廣告或俱樂部資金挑戰，機率也相同。`,
  hiddenTitle: '隱藏的內容與理由',
  hiddenPotTerm: '真實潛力',
  hiddenPot: '退役時公開。球探評價可能與真實數值略有差異。',
  hiddenBloomTerm: '大器晚成的球員',
  hiddenBloom:
    '真實潛力在 25 歲前每個賽季會隨機小幅上下浮動，並在 21 歲與 24 歲的重新評價時反映。與選擇無關，所有球員都適用相同規則。',
  hiddenStoryTerm: '劇情・特殊事件',
  hiddenStory: '為了避免劇透，經歷過一次後才會顯示在圖鑑中。機率規則與其他事件相同。',
  historyTitle: '平衡調整紀錄',
  historyLoading: '正在載入紀錄…',
  historyError: '無法載入紀錄。',
  historyEmpty: '還沒有任何調整。所有生涯都以預設平衡進行。',
  historyVersion: (p) => `版本${p.v} · ${p.day}`,
  historyActive: '目前套用中',
  historySame: '沒有變更的項目。',
  historyNote:
    '項目名稱旁是相較前一版本變更後的數值。程式更新修正是修改計算公式或規則的發布。日期為韓國時間。',
  historyPatch: '程式更新',
  historyPatchDay: (p) => `${p.day} 套用`,
  historyOpenNote: '在更新說明中查看',
  version: (p) => (p.v ? `目前新生涯套用平衡版本${p.v}。` : '目前新生涯套用預設平衡（版本 0）。'),
};

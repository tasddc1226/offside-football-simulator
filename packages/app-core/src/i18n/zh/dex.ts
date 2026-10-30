import type { Translation } from '../core';
import type { DexMsgs } from '../ko/dex';

export const dex: Translation<DexMsgs> = {
  title: '機率圖鑑',
  intro: '成功機率會依球員狀態而變化。這裡顯示可能的範圍與影響因素。',
  rulesTitle: '共通規則',
  calculating: '正在計算機率…',
  events: '事件',
  foundCount: (p) => `已發現 ${p.n}/${p.total}`,
  groupLabel: '分類',
  filterAll: '全部',
  foundMark: '已發現',
  tapHint: '點擊事件即可展開各選項的成功機率。',
  choicesHead: (p) => `${p.n} 個選項 · 成功機率`,
  lockedStory: (p) => `尚未遇到的劇情事件 · 第 ${p.stage} 階段`,
  lockedSpecial: '尚未遇到的特殊事件',
  dependsOnPast: '機率會依前一階段的選擇而改變。',
  noteWeb: '▲表示數值越高成功機率越高，▼則越低。範圍是依球員狀態可能出現的最低～最高機率。',
  noteApp: '▲表示數值越高成功機率越高，▼則越低。範圍是所有可能的球員狀態下會出現的最低～最高值。',
  oddsSafe: '安全',
  oddsSure: '確定',
  oddsVaries: '視情況',
  oddsMinigame: (p) => `一鍵 · 區間 ${p.range}%`,
  ruleRateTerm: '事件發生機率',
  ruleRate: (p) =>
    `每個階段季前賽 ${p.pre}，上半季・下半季 ${p.season}。劇情的下一階段會在預定時間另外到來。`,
  ruleSameTerm: '相同事件',
  ruleSame: (p) =>
    `出現過的事件至少 ${p.n} 個階段內不會再出現，看得越多越少出現（權重 1/(1+已看次數)）。`,
  ruleRollTerm: '成功判定',
  ruleRoll:
    '選擇畫面上顯示的 % 就是實際判定機率。0～100 之間的隨機數小於該值即成功。沒有隱藏修正，不論廣告・付費・帳號，所有玩家規則都相同。',
  ruleMiniTerm: '一鍵小遊戲',
  ruleMini:
    '十二碼罰球・一對一・PK 大戰這類有比賽畫面的選擇，以時機而非機率決定。讓在量表上來回移動的指針停在綠色區間就成功，3 秒內沒按就失敗。區間寬度由能力值決定，圖鑑上標示的是區間佔量表的寬度。開啟減少動態效果時，會以顯示的機率判定。',
  ruleSafeTerm: '安全選擇',
  ruleSafe: (p) =>
    `不經判定直接確定，但好的效果會減為 ${p.span}，並有 ${p.twist} 的機率付出代價（${p.cost} 其中之一）。`,
  ruleResultTerm: '結果數值',
  ruleResult: (p) => `其他效果會在顯示大小的 ${p.span} 之間決定。`,
  ruleTwistTerm: '意外轉折',
  ruleTwist: (p) =>
    `挑戰成功或做出確定的選擇時，有 ${p.chance} 的機率讓一項能力值再 +1～2。失敗或安全選擇不會觸發，也沒有能力值下降的轉折。`,
};

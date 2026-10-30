import type { CareerGuideMsgs } from '../ko/careerGuide';
export const careerGuide: CareerGuideMsgs = {
  candidateNote:
    '候選卡的能力值是基本分布。開球時會依細項能力值與體格重新計算，開始時的能力值可能會不同。',
  trainWeak: '弱點集中訓練可在下方的自我投資中選擇。',
  guideTitle: '球員類型圖鑑',
  guideNote: '類型由建立球員時選擇的主力組合決定。提升能力值也不會改變類型。',
  focusLabel: '推薦主力',
  combosLabel: '成為此類型的主力組合',
  synergyLabel: '團隊默契',
  synergyNote: '團隊默契需在老闆球隊中類型與站位（括號）都符合才會啟動。',
  synergyItem: (p: { name: string; slots: string }) => `${p.name}（${p.slots}）`,
  nameRule: (p: { field: string; min: number; max: number }) =>
    `${p.field}請輸入 ${p.min}～${p.max} 個字。`,
  wallTitle: '已在俱樂部的榮譽牆上留下名字。',
  occupied: (p: { number: number; holder: string }) =>
    `${p.number} 號已是 ${p.holder} 的退休背號。`,
  wallRule: '退休背號會依俱樂部・背號另外保留為競爭紀錄。',
};

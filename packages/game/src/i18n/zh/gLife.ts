import type { Translation } from '@offside/contracts/i18n';
import type { gLifeText } from '../ko/gLife';
export const gLife: Translation<typeof gLifeText> = {
  ntTitle: '國家隊退役的煩惱',
  ntText: (p) =>
    `結束第${p.caps}場國際A級賽的徵召歸來。加上俱樂部賽程重疊，身體很沉重。記者問起退出國家隊的打算。`,
  ntRetireLabel: '宣布退出國家隊',
  ntRetireResult: (p) => `以第${p.caps}場國際A級賽為終點，脫下國家隊球衣。今後只為俱樂部出賽。`,
  ntStayLabel: '回答下次徵召也會報到',
  ntStayResult: '「只要徵召，隨時都會去。」簡短回應後回到俱樂部訓練場。',
  ntRetiredLog: (p) => `宣布退出國家隊（國際A級賽出場${p.caps}場）`,
  wagsTitle: '派對後的聯絡',
  wagsText: '在派對上打過招呼的歌手出身藝人傳來訊息，約你下週一起吃晚餐。',
  wagsPublicLabel: '在餐廳大方見面',
  wagsPublicResult: '用餐照片上了新聞。兩人成了公開的情侶，對方在看台加油的身影也被轉播鏡頭拍到。',
  wagsPublicFail: '照片搶先流出，戀情報導接連不斷。隔天訓練場外擠滿了記者。',
  wagsQuietLabel: '在沒人的地方低調見面',
  wagsQuietResult: '有了只有兩人知道的愛店。比賽前一晚也在那裡安靜地吃晚餐。',
  wagsDeclineLabel: '賽季中，婉拒邀約',
  wagsDeclineResult: '回覆「賽季結束後再聯絡你」，然後走向影片分析室。',
};

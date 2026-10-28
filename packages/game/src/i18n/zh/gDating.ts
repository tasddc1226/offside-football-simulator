import type { Translation } from '@offside/contracts/i18n';
import type { gDatingText } from '../ko/gDating';
export const gDating: Translation<typeof gDatingText> = {
  title: '球場外的戀情傳聞',
  text: '兩人一起用餐的照片在網上瘋傳。記者追問你對私生活和比賽表現的看法。',
  privateLabel: '回答私生活不便公開',
  privateResult: '簡短回應後結束了採訪。下一個問題轉到了週末的比賽。',
  confirmLabel: '和對方商量後承認交往',
  confirmResult: '兩人一起發表了聲明。下次訓練場外的記者變多了。',
  pitchLabel: '表示會在球場上用表現回答',
  pitchResult: '草草結束採訪，回到訓練場。教練親自帶你做個人訓練。',
};

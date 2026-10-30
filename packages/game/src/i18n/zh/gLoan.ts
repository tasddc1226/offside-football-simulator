import type { Translation } from '@offside/contracts/i18n';
import type { gLoanText } from '../ko/gLoan';
export const gLoan: Translation<typeof gLoanText> = {
  title: '出場機會面談',
  text: '出場時間遲遲沒有增加。經紀人提起下賽季租借的事。',
  askLabel: '向俱樂部申請租借',
  askResult: '俱樂部接受了申請。賽季結束後會幫你找租借的球隊。',
  stayLabel: '留下來爭取先發',
  stayResult: '每天最早到訓練場、最晚離開。總教練開始注意到你了。',
  stayFail: '咬牙撐了下來，但下一場的名單上還是沒有你的名字。',
};

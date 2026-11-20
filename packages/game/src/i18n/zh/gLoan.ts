import type { Translation } from '@offside/contracts/i18n';
import type { gLoanText } from '../ko/gLoan';
export const gLoan: Translation<typeof gLoanText> = {
  returnTitle: '租借歸隊後的面談',
  returnRecord: (p: { club: string; apps: number }) =>
    `你在${p.club}出賽 ${p.apps} 場後歸隊。總教練問：「上半季結束時，我們要一起看哪項數字？」`,
  returnPrompt: '總教練問起你的上半季目標。',
  pickStarts: '承諾在聯賽先發 5 場',
  pickMinutes: '承諾在聯賽上場 450 分鐘',
  promiseStarts: '總教練在日曆上記下面談日期。目標是在聯賽先發 5 場。',
  promiseMinutes: '總教練記下季中面談日期。替補上場的時間也算進這 450 分鐘。',
  startsTitle: '季中面談：先發名單',
  minutesTitle: '季中面談：上場時間',
  startsReport: (p: { actual: number }) =>
    `總教練攤開上半季的先發名單。你承諾先發 5 場，實際先發 ${p.actual} 場。`,
  minutesReport: (p: { actual: number }) =>
    `總教練翻開上半季的紀錄。你承諾上場 450 分鐘，實際上場 ${p.actual} 分鐘。`,
  roleLabel: '談談下半季的角色',
  trainingLabel: '詢問下次訓練該加強什麼',
  roleMet: '「你做到了。」總教練把戰術板轉向你。',
  roleMiss: '總教練指著空位說：「我還不能保證你的位置。」',
  trainMet: '你重看達標時的比賽影片，選定下一次的訓練課題。',
  trainMiss: '這次沒有達標。你和教練約好下一次練習先試一件事。',
  title: '出場機會面談',
  text: '出場時間遲遲沒有增加。經紀人提起下賽季租借的事。',
  askLabel: '向俱樂部申請租借',
  askResult: '俱樂部接受了申請。賽季結束後會幫你找租借的球隊。',
  stayLabel: '留下來爭取先發',
  stayResult: '每天最早到訓練場、最晚離開。總教練開始注意到你了。',
  stayFail: '咬牙撐了下來，但下一場的名單上還是沒有你的名字。',
};

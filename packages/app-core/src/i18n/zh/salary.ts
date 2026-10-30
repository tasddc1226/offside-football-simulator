import type { Translation } from '../core';
import type { SalaryMsgs } from '../ko/salary';

export const salary: Translation<SalaryMsgs> = {
  title: '薪資說明',
  close: '關閉',
  intro:
    '俱樂部球隊的 11 名先發中，往季球員需要支付薪資。往季球員的薪資總和必須在預算內，才能儲存球隊。',
  free: '本賽季球員不需要薪資，放幾名都可以。',
  budget: '預算',
  used: '目前使用的薪資',
  left: '剩餘預算',
  tableTitle: '薪資表',
  tableNote: '依卡片的最高 OVR 決定，和是自己培養還是簽下的無關。',
  tableOvr: '最高 OVR',
  tableSalary: '薪資',
  bandLow: (p) => `${p.n} 以下`,
  bandRange: (p) => `${p.a}~${p.b}`,
  bandHigh: (p) => `${p.n} 以上`,
  examplesTitle: (p) => `在預算 ${p.budget} 內的搭配範例`,
  example: (p) => `OVR ${p.band} 球員 ${p.n} 名（薪資 ${p.sum}）`,
  examplesNote: '可以混搭使用，只要薪資總和在預算內就行。',
  howTitle: '編排陣容時',
  how1: '超出預算的球員會在選擇清單中顯示「超出預算」。拿掉往季球員，就能再用回那部分預算。',
  how2: '先發球員之間互換位置，薪資總和不變。',
  how3: '自動配置會在預算內挑出最強的先發。',
  whyTitle: '為什麼有薪資？',
  why1: '為了保留每個新賽季培養新球員的樂趣。本賽季球員永遠是最便宜的戰力。',
  why2: '以前往季球員最多只能放 3 名。改成薪資制後，也能選擇使用多名中段球員。',
  why3: '預算在賽季 1 為 80，之後每個賽季增加 10。薪資最多 20，所以以前排好的先發可以照常使用。',
  why4: '預算無法用俱樂部資金或付費增加。',
};

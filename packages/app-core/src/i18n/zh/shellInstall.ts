import type { Translation } from '../core';
import type { ShellInstallMsgs } from '../ko/shellInstall';

export const shellInstall: Translation<ShellInstallMsgs> = {
  conversionShopTitle: '在 App 中購買的方式',
  conversionShopBody: '進階商品需在 App 中購買。重抽券在網頁上也能用球隊資金購買。',
  conversionTitle: '在 App 中暢玩 OFFSIDE',
  conversionMilestone: '累積的紀錄，在 App 中也能管理',
  conversionBenefit:
    '在 App 中可透過獎勵廣告確認潛力、獲得額外強化機會。依使用條件與廣告供應情況而定。',
  conversionTransfer: '進行中的生涯不會自動轉移。請在設定中複製備份碼，再匯入 App。',
  conversionPlay: '在 Google Play 下載',
  conversionStore: '在 App Store 下載',
  conversionDismiss: '7 天內不再顯示 App 提示',
  stripGet: '下載 App',

  inappHint:
    '目前是在 App 內建瀏覽器（LINE、Instagram 等）中開啟。紀錄只會儲存在這個 App 裡。用外部瀏覽器開啟，登入和儲存會更安全。',
  inappHintAria: '外部瀏覽器提示',
  inappOpen: '用外部瀏覽器開啟',
  inappClose: '關閉提示',
  manualIos: '請點擊畫面上的 ···（或分享）選單中的「用 Safari 開啟」。',
  manualAndroid: '請點擊畫面上的 ···（或 ⋮）選單中的「用其他瀏覽器開啟」。',
  manualCopied: (p) => `${p.menu} 網址已複製，也可以貼到瀏覽器的網址列。`,
  openTitle: '請用外部瀏覽器開啟',
  gotIt: '我知道了',
  loginNoticeTitle: '請在外部瀏覽器中登入',
  loginNoticeBody:
    'Google 不允許在 App 內建瀏覽器（LINE、Instagram 等）中登入。請用外部瀏覽器開啟後再登入。',
  close: '關閉',
  promoSheetTitle: (p) => `用 ${p.device} App 繼續玩`,
  promoSheetText:
    '使用 App，就算很久沒開紀錄也不會消失，還能用通知接收新消息。進行中的生涯可以用設定裡的備份碼轉移到 App。',
  promoSheetStore: (p) => `在 ${p.store} 下載`,
  promoSheetHomeScreen: '加入主畫面',
  promoMoveTitle: (p) => `轉移到 ${p.device} App`,
  promoMoveTitleAny: '轉移到 App',
  promoMoveStep1: (p) => `在 ${p.stores.join(' 或 ')} 下載 OFFSIDE。`,
  promoMoveStep2: '在 App 的球隊老闆畫面用同一個 Google 帳號登入，名人堂 · 球隊紀錄就會延續。',
  promoMoveStep3: '進行中的生涯，請複製下方的備份碼，貼到 App 設定的備份中。',
};

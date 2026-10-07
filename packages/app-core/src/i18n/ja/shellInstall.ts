import type { Translation } from '../core';
import type { ShellInstallMsgs } from '../ko/shellInstall';

export const shellInstall: Translation<ShellInstallMsgs> = {
  inappHint:
    'アプリ内ブラウザ（KakaoTalk・Instagramなど）で開いています。記録はこのアプリの中にだけ保存されます。外部ブラウザで開くと、ログインと保存がより安全です。',
  inappHintAria: '外部ブラウザの案内',
  inappOpen: '外部ブラウザで開く',
  inappClose: '案内を閉じる',
  manualIos: '画面の ···（または共有）メニューから「Safariで開く」をタップしてください。',
  manualAndroid: '画面の ···（または ⋮）メニューから「他のブラウザで開く」をタップしてください。',
  manualCopied: (p) =>
    `${p.menu} アドレスをコピーしてあるので、ブラウザのアドレスバーに貼り付けても大丈夫です。`,
  openTitle: '外部ブラウザで開いてください',
  gotIt: 'わかりました',
  loginNoticeTitle: '外部ブラウザでログインしてください',
  loginNoticeBody:
    'Googleはアプリ内ブラウザ（KakaoTalk・Instagramなど）でのログインをブロックしています。外部ブラウザで開いてログインしてください。',
  close: '閉じる',
  promoTileTitle: 'iPhoneアプリ ↗',
  promoTileSub: 'App StoreでOFFSIDEを入手',
  promoSheetTitle: 'iPhoneアプリで続きをプレイ',
  promoSheetText:
    'アプリなら、しばらく開かなくても記録が消えず、新着情報を通知で受け取れます。進行中のキャリアは設定のバックアップコードでアプリに移せます。',
  promoSheetStore: 'App Storeで入手',
  promoSheetHomeScreen: 'ホーム画面に追加します',
  promoMoveTitle: 'iPhoneアプリに移る',
  promoMoveStep1: 'App StoreでOFFSIDEを入手します。',
  promoMoveStep2:
    'アプリのオーナー画面で同じGoogleアカウントでログインすると、殿堂 · クラブの記録が引き継がれます。',
  promoMoveStep3:
    '進行中のキャリアは、下のバックアップコードをコピーしてアプリの設定のバックアップに貼り付けます。',
};

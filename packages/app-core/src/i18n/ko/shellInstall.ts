// 앱 안 브라우저 안내 · 홈 화면에 추가 안내 · 웹에서 앱으로 이어 주는 안내(웹 ui/inapp*.ts · install*.ts · InAppBanner, app-core appPromo.ts).
import { ns } from '../core';

const ko = {
  inappHint:
    '카톡·인스타 안에서 열린 화면이에요. 기록은 이 앱 안에만 저장돼요. 외부 브라우저로 열면 로그인과 저장이 더 안전해요.',
  inappHintAria: '외부 브라우저 안내',
  inappOpen: '외부 브라우저로 열기',
  inappClose: '안내 닫기',
  manualIos: "화면의 ··· (또는 공유) 메뉴에서 'Safari로 열기'를 눌러 주세요.",
  manualAndroid: "화면의 ··· (또는 ⋮) 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.",
  manualCopied: (p: { menu: string }) =>
    `${p.menu} 주소를 복사해 뒀으니 브라우저 주소창에 붙여 넣어도 돼요.`,
  openTitle: '외부 브라우저에서 열어 주세요',
  gotIt: '확인했어요',
  loginNoticeTitle: '외부 브라우저에서 로그인해 주세요',
  loginNoticeBody:
    '구글이 앱 안 브라우저(카톡·인스타 등)에서의 로그인을 막고 있어요. 외부 브라우저로 열어서 로그인해 주세요.',
  close: '닫기',
  // 웹에서 앱으로 이어 주는 안내(app-core appPromo.ts)
  promoTileTitle: (p: { device: string }) => `${p.device} 앱 ↗`,
  promoTileSub: (p: { store: string }) => `${p.store}에서 오프사이드 받기`,
  promoSheetTitle: (p: { device: string }) => `${p.device} 앱으로 이어서 해요`,
  promoSheetText:
    '앱은 오래 안 들어와도 기록이 지워지지 않고, 새 소식을 알림으로 받아요. 진행 중인 커리어는 설정의 백업 코드로 앱에 옮겨요.',
  promoSheetStore: (p: { store: string }) => `${p.store}에서 받기`,
  promoSheetHomeScreen: '홈 화면에 추가할게요',
  promoMoveTitle: (p: { device: string }) => `${p.device} 앱으로 옮기기`,
  promoMoveTitleAny: '앱으로 옮기기',
  promoMoveStep1: (p: { stores: readonly string[] }) =>
    `${p.stores.join('나 ')}에서 오프사이드를 받아요.`,
  promoMoveStep2:
    '앱의 구단주 화면에서 같은 구글 계정으로 로그인하면 명예의 전당 · 구단 기록이 이어져요.',
  promoMoveStep3: '진행 중인 커리어는 아래 백업 코드를 복사해 앱 설정의 백업에 붙여 넣어요.',
};

export type ShellInstallMsgs = typeof ko;
export const shellInstallText = ns('shellInstall', ko);

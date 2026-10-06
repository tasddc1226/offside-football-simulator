// shellInstall 네임스페이스에서 나눈 부분(T-11-102, 웹 첫 화면 청크를 작게).
import { ns } from '../core';

const ko = {
  installTitle: '홈 화면에 추가하고 앱처럼 열기',
  installInapp: '외부 브라우저(Safari/Chrome)에서 열어야 홈 화면에 추가할 수 있어요.',
  installBody:
    '홈 화면의 오프사이드 아이콘으로 바로 열어요. 이 안내는 설정 > 도움말에서 다시 볼 수 있어요.',
  optOut: '다시 보지 않기',
  stepIosChrome1: '주소창 오른쪽의 공유 버튼을 눌러요.',
  stepIosChrome2: "아래 줄 맨 오른쪽의 '더 보기'를 눌러요.",
  stepIosChrome3: "목록에서 '홈 화면에 추가'를 골라요.",
  stepIosChrome4: "오른쪽 위 '추가'를 누르면 끝이에요.",
  stepIosSafari1: '화면 아래(또는 주소창 옆)의 공유 버튼을 눌러요.',
  stepIosSafari2: "목록에서 '홈 화면에 추가'를 골라요.",
  stepIosSafari3: "오른쪽 위 '추가'를 누르면 끝이에요.",
  stepAndroid1: '오른쪽 위 ⋮ 메뉴를 눌러요.',
  stepAndroid2: "'홈 화면에 추가'를 골라요.",
  stepAndroid3: "'추가'를 누르면 끝이에요.",
  stepOther1: '휴대폰 브라우저로 offside-lab.com에 들어와요.',
  stepOther2: "공유 버튼(또는 ⋮ 메뉴)에서 '홈 화면에 추가'를 골라요.",
  stepOther3: "'추가'를 누르면 끝이에요.",
};

export type ShellInstallGuideMsgs = typeof ko;
export const shellInstallGuideText = ns('shellInstallGuide', ko);

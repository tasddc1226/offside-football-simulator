import { detectInApp } from './inapp.js';
// T-10-021 '홈 화면에 추가' 안내의 브라우저별 단계. 화면(install.ts)과 떼어 단위 테스트할 수 있게 둔다.
// T-10-115 'inapp'은 카톡·인스타 같은 앱 안 브라우저 — 홈 화면 추가 메뉴가 없어 단계 대신 외부 브라우저 안내를 보인다.
export type Platform = 'ios-chrome' | 'ios-safari' | 'android' | 'other' | 'inapp';

export const INSTALL_STEPS: Record<Exclude<Platform, 'inapp'>, string[]> = {
  'ios-chrome': [
    '주소창 오른쪽의 공유 버튼을 눌러요.',
    "아래 줄 맨 오른쪽의 '더 보기'를 눌러요.",
    "목록에서 '홈 화면에 추가'를 골라요.",
    "오른쪽 위 '추가'를 누르면 끝이에요.",
  ],
  'ios-safari': [
    '화면 아래(또는 주소창 옆)의 공유 버튼을 눌러요.',
    "목록에서 '홈 화면에 추가'를 골라요.",
    "오른쪽 위 '추가'를 누르면 끝이에요.",
  ],
  android: [
    '오른쪽 위 ⋮ 메뉴를 눌러요.',
    "'홈 화면에 추가'를 골라요.",
    "'추가'를 누르면 끝이에요.",
  ],
  other: [
    '휴대폰 브라우저로 offside-lab.com 에 들어와요.',
    "공유 버튼(또는 ⋮ 메뉴)에서 '홈 화면에 추가'를 골라요.",
    "'추가'를 누르면 끝이에요.",
  ],
};

export function detectPlatform(ua: string, standalone = false): Platform {
  if (detectInApp(ua, standalone)) return 'inapp';
  if (/iPhone|iPad|iPod/.test(ua)) return /CriOS/.test(ua) ? 'ios-chrome' : 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

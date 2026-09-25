// T-10-021 '홈 화면에 추가' 안내의 브라우저별 단계. 화면(install.ts)과 떼어 단위 테스트할 수 있게 둔다.
export type Platform = 'ios-chrome' | 'ios-safari' | 'android' | 'other';

export const INSTALL_STEPS: Record<Platform, string[]> = {
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
    "'홈 화면에 추가' 또는 '앱 설치'를 골라요.",
    "'추가'(또는 '설치')를 누르면 끝이에요.",
  ],
  other: [
    '휴대폰 브라우저로 offside-lab.com 에 들어와요.',
    "공유 버튼(또는 ⋮ 메뉴)에서 '홈 화면에 추가'를 골라요.",
    "'추가'를 누르면 끝이에요.",
  ],
};

export function detectPlatform(ua: string): Platform {
  if (/iPhone|iPad|iPod/.test(ua)) return /CriOS/.test(ua) ? 'ios-chrome' : 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

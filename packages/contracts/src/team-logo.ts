/** 팀 로고는 작은 표시용 설정값이다. 업로드는 브라우저에서 줄인 래스터 이미지만 담는다. */
export const TEAM_LOGO_SHAPES = ['s', 'p', 'r', 'b'] as const;
export const TEAM_LOGO_PATTERNS = ['plain', 'v', 'sash', 'half'] as const;
export const TEAM_LOGO_IMG_MAX = 16_000;
export type TeamLogo = {
  shape: (typeof TEAM_LOGO_SHAPES)[number];
  pattern: (typeof TEAM_LOGO_PATTERNS)[number];
  text: string;
  bg: string;
  fg: string;
  img?: string | undefined;
};

export const defaultTeamLogo = (name: string): TeamLogo => {
  const chars = [...name.trim()];
  const text = chars.slice(0, 2).join('').toUpperCase();
  return {
    shape: 's',
    pattern: 'plain',
    text: (text.length <= 3 ? text : chars[0]?.toUpperCase()) || 'FC',
    bg: '#1c4a35',
    fg: '#f0b437',
  };
};

export const TEAM_LOGO_COLORS = [
  { bg: '#1c4a35', fg: '#f0b437', name: '초록 · 금색' },
  { bg: '#174386', fg: '#ffffff', name: '파랑 · 흰색' },
  { bg: '#a52e37', fg: '#ffffff', name: '빨강 · 흰색' },
  { bg: '#191f27', fg: '#f0b437', name: '검정 · 금색' },
  { bg: '#eee9dc', fg: '#283c31', name: '아이보리 · 초록' },
  { bg: '#583c80', fg: '#e9d29b', name: '보라 · 금색' },
  { bg: '#75c2cf', fg: '#172b40', name: '하늘색 · 남색' },
  { bg: '#e17831', fg: '#172b40', name: '주황 · 남색' },
] as const;

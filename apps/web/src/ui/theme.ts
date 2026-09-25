// T-10-021 다크 모드. 설정에서 켜고 끄면 <html data-theme>와 주소창 색(theme-color)을 바꾸고 이 기기에 저장한다.
// 한 번도 고르지 않았으면 시스템 설정을 따른다. 첫 페인트 전 적용은 index.html의 인라인 스크립트가 같은 키로 한다.
const KEY = 'ft_theme';
const THEME_COLOR = { light: '#E9EEE8', dark: '#0D1511' } as const;

export function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}

export function setDark(on: boolean) {
  const theme = on ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = THEME_COLOR[theme];
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // 저장 공간을 못 쓰면 이번 방문에만 적용한다.
  }
}

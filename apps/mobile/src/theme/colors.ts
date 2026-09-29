// T-11-004 웹 style.css의 색 토큰을 그대로 옮긴다(라이트/다크). 바꾸면 두 곳을 함께 고친다.
export const LIGHT = {
  bg: '#e9eee8',
  surface: '#ffffff',
  ink: '#14201a',
  muted: '#5c6b62',
  line: '#d5ddd6',
  pitch: '#1c4a35',
  onPitch: '#f2f6f1',
  pitchAccent: '#f0b437',
  accent: '#d99a12',
  accentText: '#8a5c0a',
  accentInk: '#2a1c00',
  good: '#1e7a50',
  bad: '#c0392f',
  warn: '#96600a',
};
export const DARK: typeof LIGHT = {
  bg: '#0d1511',
  surface: '#152019',
  ink: '#e6ede7',
  muted: '#8fa096',
  line: '#26352c',
  pitch: '#1a4331',
  onPitch: '#eef4ef',
  pitchAccent: '#f0b437',
  accent: '#f0b437',
  accentText: '#f0b437',
  accentInk: '#231700',
  good: '#4cc08a',
  bad: '#ef6b5f',
  warn: '#e9a83a',
};
export type Colors = typeof LIGHT;

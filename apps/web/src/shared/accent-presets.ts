// UX-004 포인트 색상 프리셋 메타데이터. packages/ui/src/tokens.css의 :root[data-accent='...']
// 블록·--os-swatch-* 토큰과 id·순서를 맞춰 둔다 — 하나를 고치면 셋 다 함께 고친다. 'DEFAULT'는
// 실제 CSS 선택자가 아니라 "data-accent 속성을 지운 상태(기본 네이비)"를 가리키는 문지기 값이다.
export type AccentPresetId = 'DEFAULT' | 'green' | 'violet' | 'crimson' | 'amber' | 'mono';

export const ACCENT_PRESET_IDS: readonly AccentPresetId[] = [
  'DEFAULT',
  'green',
  'violet',
  'crimson',
  'amber',
  'mono',
];

export interface AccentPresetOption {
  id: AccentPresetId;
  /** 스와치 옆에 병기하는 한국어 색 이름. 색만으로 구분하지 않기 위함(접근성). */
  label: string;
  /** tokens.css의 --os-swatch-* 변수 이름. 테마별 실제 프리셋 색을 그대로 미리 보여준다. */
  swatchVar: string;
}

export const ACCENT_PRESET_OPTIONS: readonly AccentPresetOption[] = [
  { id: 'DEFAULT', label: '네이비(기본)', swatchVar: '--os-swatch-default' },
  { id: 'green', label: '그린', swatchVar: '--os-swatch-green' },
  { id: 'violet', label: '바이올렛', swatchVar: '--os-swatch-violet' },
  { id: 'crimson', label: '크림슨', swatchVar: '--os-swatch-crimson' },
  { id: 'amber', label: '앰버', swatchVar: '--os-swatch-amber' },
  { id: 'mono', label: '모노', swatchVar: '--os-swatch-mono' },
];

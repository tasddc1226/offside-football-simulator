// UX-004 포인트 색상 프리셋 메타데이터 + UX-013 가상 구단 12팀 컬러 프리셋. packages/ui/src/tokens.css의
// :root[data-accent='...'] 블록·--os-swatch-* 토큰과 id·순서를 맞춰 둔다 — 하나를 고치면 셋 다 함께
// 고친다. 'DEFAULT'는 실제 CSS 선택자가 아니라 "data-accent 속성을 지운 상태(기본 네이비)"를 가리키는
// 문지기 값이다.
//
// 이 모듈은 ui-store(초기 청크)가 import하므로 룰셋(팀 이름)을 직접 읽지 않는다 — 팀 프리셋의 표시
// 이름은 설정 화면이 활성 룰셋의 teams를 넘겨 `buildAccentPresetGroups`로 만든다.
export type BaseAccentPresetId = 'DEFAULT' | 'green' | 'violet' | 'crimson' | 'amber' | 'mono';

/** 활성 룰셋 12개 구단 id. tokens.css --os-team-<id>·team-identity.ts와 순서까지 같다. */
export const TEAM_ACCENT_PRESET_TEAM_IDS = [
  'hangang-u18',
  'seorabeol-united',
  'cheongyeon-fc',
  'gangdong-rovers',
  'onsaemiro-city',
  'byeolbit-united',
  'galmae-town',
  'noeulhang-fc',
  'geumbit-fc',
  'eunha-rovers',
  'gangnaru-united',
  'dalbit-town-fc',
] as const;

export type TeamAccentTeamId = (typeof TEAM_ACCENT_PRESET_TEAM_IDS)[number];
export type TeamAccentPresetId = `team-${TeamAccentTeamId}`;
export type AccentPresetId = BaseAccentPresetId | TeamAccentPresetId;

export const BASE_ACCENT_PRESET_IDS: readonly BaseAccentPresetId[] = [
  'DEFAULT',
  'green',
  'violet',
  'crimson',
  'amber',
  'mono',
];

export const TEAM_ACCENT_PRESET_IDS: readonly TeamAccentPresetId[] =
  TEAM_ACCENT_PRESET_TEAM_IDS.map((teamId): TeamAccentPresetId => `team-${teamId}`);

/** 저장값 검증용 전체 id 목록(기본 6 + 구단 12). */
export const ACCENT_PRESET_IDS: readonly AccentPresetId[] = [
  ...BASE_ACCENT_PRESET_IDS,
  ...TEAM_ACCENT_PRESET_IDS,
];

export interface AccentPresetOption {
  id: AccentPresetId;
  /** 타일의 접근 가능한 이름(aria-label)이자 접이식 요약줄에 쓰는 한국어 이름. 색만으로 구분하지
   * 않기 위함(접근성). */
  label: string;
  /** UX-013 다듬기: 타일 아래 보이는 짧은 캡션. 생략하면 SwatchTilePicker가 label을 그대로 쓴다
   * (기본 6종은 "네이비(기본)"·"그린"처럼 label 자체가 이미 짧다). 구단 프리셋은 label이
   * "<팀명> 컬러"라 캡션에서는 "컬러"를 떼고 팀 이름만 보여준다 — aria-label·요약줄은 label을
   * 그대로 쓰므로 접근성 이름은 바뀌지 않는다. */
  caption?: string;
  /** tokens.css의 --os-swatch-* 변수 이름. 테마별 실제 프리셋 색을 그대로 미리 보여준다. */
  swatchVar: string;
}

export interface AccentPresetGroup {
  id: 'base' | 'team';
  /** 그룹 소제목("기본"·"구단"). */
  label: string;
  options: readonly AccentPresetOption[];
}

const DEFAULT_ACCENT_PRESET_OPTION: AccentPresetOption = {
  id: 'DEFAULT',
  label: '네이비(기본)',
  swatchVar: '--os-swatch-default',
};

export const BASE_ACCENT_PRESET_OPTIONS: readonly AccentPresetOption[] = [
  DEFAULT_ACCENT_PRESET_OPTION,
  { id: 'green', label: '그린', swatchVar: '--os-swatch-green' },
  { id: 'violet', label: '바이올렛', swatchVar: '--os-swatch-violet' },
  { id: 'crimson', label: '크림슨', swatchVar: '--os-swatch-crimson' },
  { id: 'amber', label: '앰버', swatchVar: '--os-swatch-amber' },
  { id: 'mono', label: '모노', swatchVar: '--os-swatch-mono' },
];

/** UX-004 호환: 기본 6종만 필요한 호출부용 별칭. */
export const ACCENT_PRESET_OPTIONS = BASE_ACCENT_PRESET_OPTIONS;

export interface AccentPresetTeamName {
  id: string;
  name: string;
}

/**
 * 룰셋 기본 팀명을 그대로 돌려준다(사용자의 구단 이름 오버라이드는 team-names.ts에만 적용 — 프리셋은
 * 팀 id 기준 색 정의라 이름을 바꿔도 같은 프리셋이어야 하고, 설정 화면 안에서 이름 입력과 색 타일이
 * 서로 갱신되는 순환을 피한다). 룰셋에 없는 팀 id는 id를 그대로 돌려준다.
 */
function teamAccentPresetName(
  teamId: TeamAccentTeamId,
  teams: readonly AccentPresetTeamName[],
): string {
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

/** 구단 프리셋의 접근 가능한 이름(aria-label)이자 요약줄 표시 이름. "<팀명> 컬러" 형태 — "컬러"는
 * 색만으로 구분하지 않기 위한 접미어다. 타일 아래 보이는 캡션은 이 접미어를 뗀
 * `teamAccentPresetName`을 쓴다(buildTeamAccentPresetOptions 참고). */
export function teamAccentPresetLabel(
  teamId: TeamAccentTeamId,
  teams: readonly AccentPresetTeamName[],
): string {
  return `${teamAccentPresetName(teamId, teams)} 컬러`;
}

export function buildTeamAccentPresetOptions(
  teams: readonly AccentPresetTeamName[],
): AccentPresetOption[] {
  return TEAM_ACCENT_PRESET_TEAM_IDS.map((teamId) => ({
    id: `team-${teamId}`,
    label: teamAccentPresetLabel(teamId, teams),
    caption: teamAccentPresetName(teamId, teams),
    swatchVar: `--os-swatch-team-${teamId}`,
  }));
}

/** 설정 화면 타일 그리드용 그룹(기본 6 / 구단 12). */
export function buildAccentPresetGroups(
  teams: readonly AccentPresetTeamName[],
): AccentPresetGroup[] {
  return [
    { id: 'base', label: '기본', options: BASE_ACCENT_PRESET_OPTIONS },
    { id: 'team', label: '구단', options: buildTeamAccentPresetOptions(teams) },
  ];
}

/** 현재 선택 프리셋의 표시 이름(요약줄·캡션용). 알 수 없는 id는 기본 이름으로 대체한다. */
export function accentPresetLabel(
  id: AccentPresetId,
  teams: readonly AccentPresetTeamName[],
): string {
  for (const group of buildAccentPresetGroups(teams)) {
    const option = group.options.find((candidate) => candidate.id === id);
    if (option !== undefined) return option.label;
  }
  return DEFAULT_ACCENT_PRESET_OPTION.label;
}

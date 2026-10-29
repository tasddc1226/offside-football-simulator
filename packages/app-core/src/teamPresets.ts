// T-11-217 팀 프리셋(포메이션 · 선발 · 배치 최대 5개) — 웹 team/TeamPresets · 앱 owner/TeamPresets가 같이 쓴다.
// 프리셋은 편성 초안만 채운다. 팀 반영은 저장 버튼이 하고, 선수 · 컵 잠금 검사도 그때 서버가 한다.
// T-11-570 컵 명단으로 고른 프리셋 하나는 컵 경기에 그대로 나간다(고르거나 고칠 때 서버가 컵 검사를 한다).
import type { TeamPreset } from '@offside/contracts';
import {
  TEAM_PRESET_MAX,
  shapeOf,
  type FormationId,
  type TeamPosition,
} from '@offside/contracts/owner-team';

export { TEAM_PRESET_NAME_MAX } from '@offside/contracts/owner-team';
export type { TeamPreset };

/** 지금 편성 초안으로 만든 프리셋. */
export const presetOf = (
  name: string,
  formation: FormationId,
  slots: readonly (string | null)[],
  layout: readonly TeamPosition[] | null,
): TeamPreset => ({
  name: name.trim(),
  formation,
  slots: [...slots],
  layout: layout ? layout.map((p) => ({ ...p })) : null,
});

/** 겹치지 않는 기본 이름(프리셋 1, 2, …). */
export function nextPresetName(
  presets: readonly TeamPreset[],
  label: (p: { n: number }) => string,
) {
  let n = presets.length + 1;
  while (presets.some((p) => p.name === label({ n }))) n++;
  return label({ n });
}

export const presetsFull = (presets: readonly TeamPreset[]) => presets.length >= TEAM_PRESET_MAX;

/** 프리셋을 초안으로 펼친다. 지금 넣을 수 없는 선수(판매 · 방출)는 자리를 비우고 그 수를 센다. */
export function loadPreset(preset: TeamPreset, owned: ReadonlySet<string>) {
  const slots = preset.slots.map((id) => (id && owned.has(id) ? id : null));
  return {
    formation: preset.formation,
    layout: preset.layout ? preset.layout.map((p) => ({ ...p })) : null,
    slots,
    missing: preset.slots.filter((id) => id && !owned.has(id)).length,
  };
}

/** 목록 한 줄 요약에 쓰는 배치 이름과 선발 수. */
export const presetSummary = (preset: TeamPreset) => ({
  shape: shapeOf(preset.formation, preset.layout),
  starters: preset.slots.filter(Boolean).length,
});

/** 덮어써도 컵 명단 표시는 남긴다(T-11-570). */
export const replacePreset = (presets: readonly TeamPreset[], i: number, next: TeamPreset) =>
  presets.map((p, j) => (j === i ? { ...next, ...(p.cup ? { cup: true as const } : {}) } : p));
/** T-11-570 i번째를 컵 명단으로(null이면 컵 명단을 푼다). 컵 명단은 하나뿐이다. */
export const setCupPreset = (presets: readonly TeamPreset[], i: number | null): TeamPreset[] =>
  presets
    .map(({ cup: _cup, ...p }) => p as TeamPreset)
    .map((p, j) => (j === i ? { ...p, cup: true } : p));
/** T-11-570 컵 명단 프리셋(없으면 null). */
export const cupPresetOf = (presets: readonly TeamPreset[] | undefined) =>
  presets?.find((p) => p.cup) ?? null;
export const renamePreset = (presets: readonly TeamPreset[], i: number, name: string) =>
  presets.map((p, j) => (j === i ? { ...p, name: name.trim() } : p));
export const removePreset = (presets: readonly TeamPreset[], i: number) =>
  presets.filter((_, j) => j !== i);

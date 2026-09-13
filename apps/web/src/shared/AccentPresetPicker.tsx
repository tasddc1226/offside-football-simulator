// UX-004 → UX-013: 설정 "홈 색상" 항목. packages/ui SwatchTilePicker(radiogroup 4열 타일 그리드)에
// 기본 6종 + K1 리그 12개 구단 컬러 프리셋을 그룹으로 채운다. 구단 프리셋의 aria-label·요약줄
// 이름은 팀 기본명 + " 컬러"(구단 이름 오버라이드 미적용, accent-presets.ts 참고), 타일 아래
// 보이는 캡션은 "컬러"를 뗀 팀 이름만(UX-013 다듬기). 선택 상태는 타일 링 + 체크 아이콘으로,
// 색만으로 구분하지 않는다.
//
// 팀 이름은 activeRuleset(운영 승격 전에는 여전히 1.4.0)이 아니라 룰셋 1.5.0을 직접 읽는다 —
// TEAM_ACCENT_PRESET_TEAM_IDS가 1.5.0의 K1 구단 id 목록이라, activeRuleset이 아직 1.5.0으로
// 승격되기 전에도(별도 릴리스 PR 전) 라벨이 원시 id로 깨지지 않는다.
import { useMemo } from 'react';
import { SwatchTilePicker } from '@offside/ui';
import { loadRuleset } from '@offside/content';
import { buildAccentPresetGroups, type AccentPresetId } from './accent-presets.js';

const TEAM_ACCENT_PRESET_RULESET_VERSION = '1.5.0';

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;

export interface AccentPresetPickerProps {
  value: AccentPresetId;
  onValueChange: (value: AccentPresetId) => void;
  /** 제목을 바깥(예: Disclosure summary)이 이미 보여주면 false — radiogroup 이름은 aria-label로 준다. */
  showHeading?: boolean;
}

export function AccentPresetPicker({
  value,
  onValueChange,
  showHeading = true,
}: AccentPresetPickerProps) {
  const groups = useMemo(
    () => buildAccentPresetGroups(loadRuleset(TEAM_ACCENT_PRESET_RULESET_VERSION).teams),
    [],
  );
  const headingId = 'settings-accent-preset';

  return (
    <section className="flex flex-col gap-os-3">
      {showHeading ? (
        <h2 id={headingId} className="font-os font-semibold text-os-text" style={H2_STYLE}>
          홈 색상
        </h2>
      ) : null}
      <SwatchTilePicker
        groups={groups}
        value={value}
        onValueChange={(next) => onValueChange(next as AccentPresetId)}
        {...(showHeading ? { 'aria-labelledby': headingId } : { 'aria-label': '홈 색상' })}
      />
    </section>
  );
}

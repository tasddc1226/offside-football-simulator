// UX-001: 설정 "구단 이름" 섹션. 활성 룰셋(activeRuleset)의 12개 구단을 리그 등급별로 묶어 보여주고,
// 각 구단마다 기본 이름 placeholder가 있는 텍스트 인풋 + 그 아래 플레이버 텍스트 한 줄을 둔다.
// 저장은 기기 로컬(ui-store.ts의 teamNameOverrides)뿐이라 다른 기기·서버 프로필과는 동기화되지
// 않는다 — SLB(야구 게임)의 "구단 이름 변경"과 같은 로컬 전용 커스터마이즈다.
import type { Team } from '@offside/domain';
import { Button, TeamBadge } from '@offside/ui';
import { activeRuleset } from '../engine/content.js';
import { LEAGUE_TIER_LABEL_KO } from './labels.js';
import { TEAM_FLAVOR_TEXT } from './team-flavor.js';
import { getTeamIdentity } from './team-identity.js';
import { useUiStore } from './ui-store.js';

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;
const FIELD_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const FIELD_CLASS = 'os-input w-full font-os text-os-text';

/** 이름 규칙: 트림 후 1~16자. store의 setTeamNameOverride가 같은 규칙으로 다시 한번 정리한다. */
const TEAM_NAME_MAX_LENGTH = 16;

const LEAGUE_TIER_ORDER: readonly Team['leagueTier'][] = ['YOUTH', 1, 2, 3];

function groupTeamsByTier(teams: readonly Team[]): Array<{ tier: Team['leagueTier']; teams: Team[] }> {
  return LEAGUE_TIER_ORDER.map((tier) => ({
    tier,
    teams: teams.filter((team) => team.leagueTier === tier),
  })).filter((group) => group.teams.length > 0);
}

function TeamNameField({ team }: { team: Team }) {
  const override = useUiStore((state) => state.teamNameOverrides[team.id]);
  const setTeamNameOverride = useUiStore((state) => state.setTeamNameOverride);
  const inputId = `team-name-${team.id}`;
  const identity = getTeamIdentity(team.id);

  return (
    <div className="flex flex-col gap-os-1">
      <label
        htmlFor={inputId}
        className="flex items-center gap-os-2 font-os font-semibold text-os-text"
        style={H2_STYLE}
      >
        <TeamBadge initials={identity.initials} colorVar={identity.colorVar} size="s" />
        {team.name}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        placeholder={team.name}
        maxLength={TEAM_NAME_MAX_LENGTH}
        value={override ?? ''}
        onChange={(event) => setTeamNameOverride(team.id, event.target.value)}
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {TEAM_FLAVOR_TEXT[team.id] ?? ''}
      </p>
    </div>
  );
}

export function TeamNamesSettings() {
  const resetTeamNameOverrides = useUiStore((state) => state.resetTeamNameOverrides);
  const tierGroups = groupTeamsByTier(activeRuleset.teams);

  return (
    <section
      id="settings-team-names"
      className="flex scroll-mt-20 flex-col gap-os-5"
      aria-labelledby="settings-team-names-title"
    >
      <h2 id="settings-team-names-title" className="os-section-title">
        구단 이름
      </h2>
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        게임 속 구단 이름을 원하는 대로 바꿔보세요. 변경한 이름은 이 기기에서만 적용됩니다.
      </p>

      {tierGroups.map((group) => (
        <section key={group.tier} className="flex flex-col gap-os-3">
          <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
            {LEAGUE_TIER_LABEL_KO[group.tier]}
          </h2>
          <div className="flex flex-col gap-os-4">
            {group.teams.map((team) => (
              <TeamNameField key={team.id} team={team} />
            ))}
          </div>
        </section>
      ))}

      <Button variant="secondary" onClick={resetTeamNameOverrides}>
        기본값 복원
      </Button>
    </section>
  );
}

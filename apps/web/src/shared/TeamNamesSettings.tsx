// UX-001 → UX-013: 설정 "구단 이름·로고 변경" 접이식의 본문. 활성 룰셋(activeRuleset)의 12개 구단을
// 리그 등급별로 묶어 보여주고, 각 구단마다 기본 이름 placeholder가 있는 텍스트 인풋 + 플레이버 텍스트
// 한 줄 + 로고 변경(file input)·기본 로고 복원 버튼을 둔다. 저장은 기기 로컬(ui-store.ts의
// teamNameOverrides·teamLogos)뿐이라 다른 기기·서버 프로필과는 동기화되지 않는다 — SLB(야구 게임)의
// "TEAM SETTINGS"와 같은 로컬 전용 커스터마이즈다. 바깥 섹션·h2·Disclosure는 settings.tsx가 그린다
// (헤딩 계층 h1 배너 → h2 섹션 → 여기 리그 등급 h3).
import { useState, type ChangeEvent } from 'react';
import type { Team } from '@offside/domain';
import { Button, Toast, buttonClassName, buttonStyle } from '@offside/ui';
import { activeRuleset } from '../engine/content.js';
import { ClubBadge } from './ClubBadge.js';
import { LEAGUE_TIER_LABEL_KO } from './labels.js';
import { TEAM_FLAVOR_TEXT } from './team-flavor.js';
import {
  TEAM_LOGO_ACCEPT,
  TEAM_LOGO_ERROR_MESSAGE,
  TeamLogoError,
  processTeamLogo,
} from './team-logo.js';
import { useUiStore } from './ui-store.js';

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;
const FIELD_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;
const FIELD_CLASS = 'os-input w-full font-os text-os-text';
/* 숨긴 file input이 포커스를 받으면(peer) 보이는 라벨 버튼에 포커스 링을 그린다. */
const LOGO_LABEL_CLASS =
  'cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-os-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-60';

/** 이름 규칙: 트림 후 1~16자. store의 setTeamNameOverride가 같은 규칙으로 다시 한번 정리한다. */
const TEAM_NAME_MAX_LENGTH = 16;

const LEAGUE_TIER_ORDER: readonly Team['leagueTier'][] = ['YOUTH', 1, 2, 3];

type TeamToast = { variant: 'success' | 'error'; message: string };

function groupTeamsByTier(
  teams: readonly Team[],
): Array<{ tier: Team['leagueTier']; teams: Team[] }> {
  return LEAGUE_TIER_ORDER.map((tier) => ({
    tier,
    teams: teams.filter((team) => team.leagueTier === tier),
  })).filter((group) => group.teams.length > 0);
}

function TeamRow({ team, onToast }: { team: Team; onToast: (toast: TeamToast) => void }) {
  const override = useUiStore((state) => state.teamNameOverrides[team.id]);
  const hasLogo = useUiStore((state) => state.teamLogos[team.id] !== undefined);
  const setTeamNameOverride = useUiStore((state) => state.setTeamNameOverride);
  const setTeamLogo = useUiStore((state) => state.setTeamLogo);
  const clearTeamLogo = useUiStore((state) => state.clearTeamLogo);
  const [busy, setBusy] = useState(false);
  const inputId = `team-name-${team.id}`;
  const fileId = `team-logo-${team.id}`;

  async function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 골라도 change가 나도록 비운다.
    event.target.value = '';
    if (file === undefined) return;
    setBusy(true);
    try {
      const dataUrl = await processTeamLogo(file);
      setTeamLogo(team.id, dataUrl);
      onToast({ variant: 'success', message: `${team.name} 로고를 바꿨습니다` });
    } catch (error) {
      onToast({
        variant: 'error',
        message:
          error instanceof TeamLogoError ? error.message : TEAM_LOGO_ERROR_MESSAGE.DECODE_FAILED,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-os-2">
      <div className="flex items-center gap-os-2">
        <ClubBadge teamId={team.id} size="m" />
        <label htmlFor={inputId} className="font-os font-semibold text-os-text" style={H2_STYLE}>
          {team.name}
        </label>
      </div>
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
      <div className="flex flex-wrap items-center gap-os-2">
        <input
          id={fileId}
          type="file"
          accept={TEAM_LOGO_ACCEPT}
          className="peer sr-only"
          aria-label={`${team.name} 로고 변경`}
          disabled={busy}
          onChange={(event) => void handleLogoFile(event)}
        />
        <label
          htmlFor={fileId}
          className={buttonClassName('secondary', LOGO_LABEL_CLASS)}
          style={buttonStyle}
        >
          {busy ? '처리 중…' : '로고 변경'}
        </label>
        {hasLogo ? (
          <Button
            variant="ghost"
            onClick={() => clearTeamLogo(team.id)}
            aria-label={`${team.name} 기본 로고`}
          >
            기본 로고
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TeamNamesSettings() {
  const resetTeamNameOverrides = useUiStore((state) => state.resetTeamNameOverrides);
  const resetTeamLogos = useUiStore((state) => state.resetTeamLogos);
  const [toast, setToast] = useState<TeamToast | null>(null);
  const tierGroups = groupTeamsByTier(activeRuleset.teams);

  return (
    <div className="flex flex-col gap-os-5">
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        게임 속 구단 이름과 로고를 원하는 대로 바꿔보세요. 이름·로고 변경은 이 기기에만 적용됩니다.
      </p>
      <div className="flex flex-wrap gap-os-2">
        <Button variant="secondary" onClick={resetTeamNameOverrides}>
          이름 기본값
        </Button>
        <Button variant="secondary" onClick={resetTeamLogos}>
          로고 기본값
        </Button>
      </div>

      {tierGroups.map((group) => (
        <section
          key={group.tier}
          className="flex flex-col gap-os-3"
          aria-labelledby={`settings-team-tier-${group.tier}`}
        >
          <h3
            id={`settings-team-tier-${group.tier}`}
            className="font-os font-semibold text-os-text"
            style={H2_STYLE}
          >
            {LEAGUE_TIER_LABEL_KO[group.tier]}
          </h3>
          <div className="flex flex-col gap-os-5">
            {group.teams.map((team) => (
              <TeamRow key={team.id} team={team} onToast={setToast} />
            ))}
          </div>
        </section>
      ))}

      {toast !== null ? (
        <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </div>
  );
}

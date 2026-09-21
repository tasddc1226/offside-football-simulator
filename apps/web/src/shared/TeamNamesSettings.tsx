// UX-001 → UX-013: 설정 "구단 이름·로고 변경" 접이식의 본문. 활성 룰셋(activeRuleset)의 구단을
// 실제 리그별로 묶어 보여주고, 각 구단마다 기본 이름 placeholder가 있는 텍스트 인풋 + 플레이버 텍스트
// 한 줄 + 로고 변경(file input)·기본 로고 복원 버튼을 둔다. 저장은 기기 로컬(ui-store.ts의
// teamNameOverrides·teamLogos)뿐이라 다른 기기·서버 프로필과는 동기화되지 않는다 — SLB(야구 게임)의
// "TEAM SETTINGS"와 같은 로컬 전용 커스터마이즈다. 바깥 섹션·h2·Disclosure는 settings.tsx가 그린다
// (헤딩 계층 h1 배너 → h2 섹션 → 여기 리그 등급 h3).
import { useEffect, useState, type ChangeEvent } from 'react';
import type { Team } from '@offside/domain';
import { Button, Toast, buttonClassName, buttonStyle } from '@offside/ui';
import { activeRuleset } from '../engine/content.js';
import { useCareerList } from '../engine/use-career.js';
import { ClubBadge } from './ClubBadge.js';
import { LEAGUE_TIER_LABEL_KO } from './labels.js';
import './settings-screen.css';
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

type TeamToast = { variant: 'success' | 'error'; message: string };

export function groupTeamsByLeague(
  teams: readonly Team[],
  search: string,
  overrides: Record<string, string>,
  leagues: readonly { id: string; tier: Team['leagueTier']; name: string }[],
): Array<{ id: string; tier: Team['leagueTier']; name: string; teams: Team[] }> {
  const normalized = search.trim().toLocaleLowerCase();
  return leagues
    .map((league) => ({
      id: league.id,
      tier: league.tier,
      name: league.name,
      teams: teams.filter((team) => {
        if (team.leagueId !== league.id) return false;
        if (normalized.length === 0) return true;
        const displayName = overrides[team.id] ?? team.name;
        const flavor = TEAM_FLAVOR_TEXT[team.id] ?? '';
        const leagueText = `${league.name} ${league.id}`;
        return `${team.name} ${displayName} ${flavor} ${leagueText}`
          .toLocaleLowerCase()
          .includes(normalized);
      }),
    }))
    .filter((group) => group.teams.length > 0);
}

/**
 * 실제 리그 identity를 보존하는 화면: 그룹 헤딩은 활성 룰셋의 `leagues[].name`으로 표시한다.
 * 구버전에서 leagueId를 찾지 못하면(방어적 폴백)
 * 기존 `LEAGUE_TIER_LABEL_KO`("유스/1부/2부/3부")를 그대로 쓴다. 다른 화면(계약·이적 등)의
 * 티어 라벨은 `LEAGUE_TIER_LABEL_KO`를 그대로 쓰므로 건드리지 않는다.
 */
function teamGroupHeadingLabel(group: {
  id: string;
  tier: Team['leagueTier'];
  name: string;
}): string {
  return group.name || LEAGUE_TIER_LABEL_KO[group.tier];
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
  const displayName = override ?? team.name;

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
        <ClubBadge teamId={team.id} teamName={team.name} size="m" />
        <label htmlFor={inputId} className="font-os font-semibold text-os-text" style={H2_STYLE}>
          {displayName}
        </label>
      </div>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        placeholder={team.name}
        aria-label={`${team.name} 표시 이름`}
        maxLength={TEAM_NAME_MAX_LENGTH}
        value={override ?? ''}
        onChange={(event) => setTeamNameOverride(team.id, event.target.value)}
        className={FIELD_CLASS}
        style={FIELD_STYLE}
      />
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        {TEAM_FLAVOR_TEXT[team.id] ?? ''}
      </p>
      <div className="relative flex flex-wrap items-center gap-os-2">
        <input
          id={fileId}
          type="file"
          accept={TEAM_LOGO_ACCEPT}
          className="peer os-team-logo-input"
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
  const careers = useCareerList();
  const resetTeamNameOverrides = useUiStore((state) => state.resetTeamNameOverrides);
  const resetTeamLogos = useUiStore((state) => state.resetTeamLogos);
  const overrides = useUiStore((state) => state.teamNameOverrides);
  const [toast, setToast] = useState<TeamToast | null>(null);
  const [search, setSearch] = useState('');
  const activeTeamId = careers.data
    ?.filter((career) => career.state.status === 'ACTIVE')
    .map((career) => career.state.contract?.teamId ?? career.state.season?.teamId)
    .find((teamId): teamId is string => teamId !== undefined);
  const currentLeagueId = activeRuleset.teams.find((team) => team.id === activeTeamId)?.leagueId;
  const tierGroups = groupTeamsByLeague(
    activeRuleset.teams,
    search,
    overrides,
    activeRuleset.leagues,
  );
  const fallbackLeagueId = tierGroups[0]?.id;
  const [openTiers, setOpenTiers] = useState<Set<string>>(
    () => new Set([currentLeagueId ?? fallbackLeagueId ?? 'league-youth']),
  );
  const [accordionTouched, setAccordionTouched] = useState(false);
  useEffect(() => {
    if (accordionTouched || currentLeagueId === undefined) return;
    setOpenTiers(new Set([currentLeagueId]));
  }, [accordionTouched, currentLeagueId]);

  function toggleTier(tier: string) {
    setAccordionTouched(true);
    setOpenTiers((previous) => {
      const next = new Set(previous);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-os-5">
      <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
        게임 속 구단 이름과 로고를 원하는 대로 바꿔보세요. 이름·로고 변경은 이 기기에만 적용됩니다.
      </p>
      <label className="flex flex-col gap-os-1 font-os text-os-text" style={CAPTION_STYLE}>
        구단 찾기
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="구단 이름 또는 리그"
          aria-label="구단 찾기"
          className={FIELD_CLASS}
          style={FIELD_STYLE}
        />
      </label>
      <div className="flex flex-wrap gap-os-2">
        <Button variant="secondary" onClick={resetTeamNameOverrides}>
          이름 기본값
        </Button>
        <Button variant="secondary" onClick={resetTeamLogos}>
          로고 기본값
        </Button>
      </div>

      {tierGroups.length === 0 ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          검색 결과가 없습니다. 구단 이름을 다시 확인해 주세요.
        </p>
      ) : (
        tierGroups.map((group) => {
          const headingId = `settings-team-tier-${group.id}`;
          const panelId = `${headingId}-panel`;
          const open = openTiers.has(group.id);
          return (
            <section key={group.id} className="flex flex-col gap-os-3" aria-labelledby={headingId}>
              <h3 id={headingId} className="m-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-os-2 rounded-os-s px-os-2 py-os-2 text-left font-os font-semibold text-os-text"
                  style={{ minHeight: 'var(--os-touch-min)' }}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggleTier(group.id)}
                >
                  <span style={H2_STYLE}>{teamGroupHeadingLabel(group)}</span>
                  <span aria-hidden="true">{open ? '−' : '+'}</span>
                </button>
              </h3>
              <div id={panelId} hidden={!open} className="flex flex-col gap-os-5">
                {group.teams.map((team) => (
                  <TeamRow key={team.id} team={team} onToast={setToast} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {toast !== null ? (
        <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </div>
  );
}

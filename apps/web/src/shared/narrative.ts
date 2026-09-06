// 04-event-engine.md "결과 해결" 6단계: narrative token을 확정 값으로 렌더링한다.
import { PARTICLE_PAIRS, type ContentPack } from '@offside/content';
import type { CareerState, Ruleset } from '@offside/domain';
import { currentTeamName } from './current-team.js';
import type { TeamNameOverrides } from './team-names.js';

const TOKEN_PATTERN = /\{([a-zA-Z]+)(?::([^}]*))?\}/g;

// `agent`는 content 0.2.0에서 추가된 공개 토큰이다. 활성 팩은 0.1.0을 유지하지만, import/replay
// 화면이 새 팩을 명시적으로 읽을 때도 동일한 렌더러가 동작해야 한다.
const STATIC_TOKEN_KEYS = ['name', 'club', 'team', 'manager', 'rival', 'captain', 'agent'] as const;
type StaticTokenKey = (typeof STATIC_TOKEN_KEYS)[number];

function isStaticTokenKey(name: string): name is StaticTokenKey {
  return (STATIC_TOKEN_KEYS as readonly string[]).includes(name);
}

export type NarrativeTokenValues = Record<StaticTokenKey, string> & { delta?: number };

/**
 * 마지막 글자가 한글 음절(U+AC00~U+D7A3)이면 유니코드 공식으로 받침 유무를 계산한다. 한글 음절이
 * 아니면(로마자 약어 등, 예: "한강 FC") 받침 없음으로 취급한다 — 실제 발음("씨")도 받침이 없다.
 */
function hasBatchim(value: string): boolean {
  const lastChar = value.trim().at(-1);
  if (lastChar === undefined) return false;
  const code = lastChar.codePointAt(0) ?? 0;
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function resolveParticle(pair: string, withBatchim: boolean): string {
  const [withB, withoutB] = pair.split('/');
  if (withB === undefined || withoutB === undefined) return pair;
  return withBatchim ? withB : withoutB;
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/**
 * `{name}`·`{club}`·`{manager}`·`{rival}`·`{captain}`·`{team}`·`{agent}`·`{delta:formatted}`와 조사 접미
 * (`{name:이/가}` 등)를 치환한다. 사전에 없는 token·잘못된 조사 쌍은 content 스키마
 * (`findNarrativeTokenIssues`)가 배포 전에 막으므로, 여기서는 매칭 실패 시 원문을 그대로 남긴다
 * (방어적 동작으로 실제 콘텐츠에서는 도달하지 않는다).
 */
export function renderNarrative(text: string, tokens: NarrativeTokenValues): string {
  return text.replace(TOKEN_PATTERN, (match: string, name: string, suffix: string | undefined) => {
    if (name === 'delta') {
      return tokens.delta === undefined ? match : formatDelta(tokens.delta);
    }
    if (!isStaticTokenKey(name)) return match;

    const value = tokens[name];
    if (suffix === undefined) return value;
    if (!(PARTICLE_PAIRS as readonly string[]).includes(suffix)) return match;
    return value + resolveParticle(suffix, hasBatchim(value));
  });
}

/**
 * `name`은 선수 이름, `team`·`club`은 현재 팀(계약이 있으면 `contract.teamName`, 없으면 배경 시작
 * 팀 이름), `manager`는 도메인 값(`season.manager.name`, 없으면 `nextManager.name`)을 우선하고
 * 둘 다 없을 때만 팩 사전 첫 값으로 대체한다. 나머지(`rival`·`captain`)는 팩 `narrativeTokens`의
 * 첫 값이다.
 */
export function buildNarrativeTokens(
  state: CareerState,
  pack: ContentPack,
  ruleset: Ruleset,
  teamNameOverrides: TeamNameOverrides = {},
): NarrativeTokenValues {
  const team = currentTeamName(state, ruleset, teamNameOverrides);
  return {
    name: state.player.profile?.name ?? state.player.draft.name ?? '',
    club: team,
    team,
    manager: state.season?.manager?.name ?? state.nextManager?.name ?? pack.narrativeTokens.manager[0] ?? '',
    rival: pack.narrativeTokens.rival[0] ?? '',
    captain: pack.narrativeTokens.captain[0] ?? '',
    agent: pack.narrativeTokens.agent[0] ?? '',
  };
}

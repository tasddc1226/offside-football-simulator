// SCR-002·003·004의 순수 로직(React 없음). 폼 검증·포지션 묶음·아키타입 비교 행 계산·배경 위험도
// 표시를 이 모듈에 모아 단위 테스트로 고정한다.
import {
  positionGroupOf,
  type Archetype,
  type AttributeKey,
  type Position,
  type PositionGroup,
  type Ruleset,
} from '@offside/domain';
import type { RiskLevel, StepperStep } from '@offside/ui';
import { ATTRIBUTE_LABELS } from './labels.js';

/** SCR-002·003·004 공통 Stepper(정보 → 스타일 → 확인). */
export const PLAYER_CREATION_STEPS: StepperStep[] = [
  { id: 'info', label: '정보' },
  { id: 'style', label: '스타일' },
  { id: 'confirm', label: '확인' },
];

/**
 * SCR-002·003·004 `screen_viewed`의 `careerPhase`. 세 화면 모두 Career 확정 전(DRAFT)이고 Phase 1은
 * 생성 단계가 YOUTH뿐이라 고정값이 맞다(발견 사항 6) — state에서 읽지 않고 이 상수 하나를 공유한다.
 */
export const PLAYER_CREATION_CAREER_PHASE = 'YOUTH';

const POSITION_GROUP_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

/** 룰셋 `positions`를 포지션군 4개 탭으로 나눈다(GK·DEF·MID·FWD 순, 각 그룹 안은 룰셋 원래 순서). */
export function positionsByGroup(positions: readonly Position[]): Array<{ group: PositionGroup; positions: Position[] }> {
  const byGroup = new Map<PositionGroup, Position[]>(POSITION_GROUP_ORDER.map((group) => [group, []]));
  for (const position of positions) {
    byGroup.get(positionGroupOf(position))?.push(position);
  }
  return POSITION_GROUP_ORDER.filter((group) => (byGroup.get(group) ?? []).length > 0).map((group) => ({
    group,
    positions: byGroup.get(group) ?? [],
  }));
}

export function archetypesForPosition(ruleset: Ruleset, position: Position): Archetype[] {
  return ruleset.archetypes.filter((archetype) => archetype.position === position);
}

/**
 * SCR-003 인수 조건: 포지션이 바뀌었고 기존 archetypeId가 새 포지션의 아키타입이 아니면 같은
 * UPDATE_PLAYER_DRAFT 명령에 archetypeId: null을 함께 보내야 한다(그렇지 않으면 domain이
 * ARCHETYPE_POSITION_MISMATCH로 명령 전체를 거부한다).
 */
export function shouldResetArchetype(ruleset: Ruleset, nextPosition: Position, currentArchetypeId: string | null): boolean {
  if (currentArchetypeId === null) return false;
  const archetype = ruleset.archetypes.find((candidate) => candidate.id === currentArchetypeId);
  return archetype === undefined || archetype.position !== nextPosition;
}

function sortedByValueDesc<K extends string>(entries: Partial<Record<K, number>>): K[] {
  return (Object.entries(entries) as Array<[K, number]>).sort((a, b) => b[1] - a[1]).map(([key]) => key);
}

/** SCR-003 "핵심 능력": roleWeights 상위 `count`개. */
export function topAttributeKeys(archetype: Archetype, count: number): AttributeKey[] {
  return sortedByValueDesc(archetype.roleWeights).slice(0, count);
}

/** SCR-003 "약점": template에서 가장 낮은 `count`개. */
export function weakestAttributeKeys(archetype: Archetype, count: number): AttributeKey[] {
  return (Object.entries(archetype.template) as Array<[AttributeKey, number]>)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([key]) => key);
}

/**
 * 같은 포지션의 다른 아키타입보다 실제 template 값이 낮은 능력을 비교한다. 포지션 아키타입 중
 * 누구도 roleWeights에 쓰지 않는 능력(예: 필드 플레이어의 골키핑)은 비교에서 제외한다.
 */
export function relativeWeaknessAttributeKeys(
  ruleset: Ruleset,
  archetype: Archetype,
  count: number,
): AttributeKey[] {
  const peers = archetypesForPosition(ruleset, archetype.position).filter(
    (candidate) => candidate.id !== archetype.id,
  );
  const relevant = new Set<AttributeKey>();
  for (const candidate of [archetype, ...peers]) {
    for (const [key, weight] of Object.entries(candidate.roleWeights) as Array<[AttributeKey, number]>) {
      if (weight > 0) relevant.add(key);
    }
  }
  return [...relevant]
    .map((key) => ({
      key,
      gap: (archetype.template[key] ?? 0) - Math.max(...peers.map((peer) => peer.template[key] ?? 0)),
      value: archetype.template[key] ?? 0,
    }))
    .filter((entry) => entry.gap < 0)
    .sort((a, b) => a.gap - b.gap || a.value - b.value || a.key.localeCompare(b.key))
    .slice(0, count)
    .map((entry) => entry.key);
}

export function attributeLabelList(keys: AttributeKey[]): string {
  return keys.map((key) => ATTRIBUTE_LABELS[key]).join(', ');
}

export type NameValidation = { ok: true; value: string } | { ok: false; message: string };

/**
 * SCR-002 이름 입력의 즉시 피드백. domain의 UPDATE_PLAYER_DRAFT 검증(simulate.ts)과 규칙을
 * 맞춘다(trim 뒤 길이, 제어문자 금지) — 서버·엔진 쪽 검증이 최종 권위이고, 이건 제출 전 UX용이다.
 */
export function validateDraftName(raw: string, rules: { nameMin: number; nameMax: number }): NameValidation {
  const trimmed = raw.trim();
  if (trimmed.length < rules.nameMin || trimmed.length > rules.nameMax) {
    return { ok: false, message: `이름은 ${rules.nameMin}~${rules.nameMax}자여야 합니다.` };
  }
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return { ok: false, message: '이름에 제어문자·줄바꿈을 쓸 수 없습니다.' };
    }
  }
  return { ok: true, value: trimmed };
}

/**
 * 배경 위험도(ChoiceCard가 요구하는 riskLevel). 룰셋에 위험도 필드가 없어 화면이 attributeDeltas의
 * 변동 폭으로 판단한다: 변경 없음(club-academy) LOW, 소폭 보정(school) MEDIUM, 큰 폭 보정(street)
 * HIGH. 새 배경이 룰셋에 추가되면 이 표도 함께 갱신해야 한다.
 */
const BACKGROUND_RISK: Record<string, RiskLevel> = {
  'club-academy': 'LOW',
  school: 'MEDIUM',
  street: 'HIGH',
};

export const RISK_LABELS: Record<RiskLevel, string> = { LOW: '낮음', MEDIUM: '보통', HIGH: '높음' };

export function backgroundRiskLevel(backgroundId: string): RiskLevel {
  return BACKGROUND_RISK[backgroundId] ?? 'MEDIUM';
}

function formatSignedInt(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
}

/** ChoiceCard의 "미리보기 예상 효과 문장 목록". 변화가 없으면 안정적이라는 한 줄로 대신한다. */
export function backgroundEffectLines(attributeDeltas: Partial<Record<AttributeKey, number>>): string[] {
  const entries = Object.entries(attributeDeltas) as Array<[AttributeKey, number]>;
  if (entries.length === 0) return ['능력치 변화 없음. 안정적인 훈련 환경.'];
  return entries.map(([key, delta]) => `${ATTRIBUTE_LABELS[key]} ${formatSignedInt(delta)}`);
}

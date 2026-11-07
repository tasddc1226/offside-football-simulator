// ───────── T-11-669 은퇴 화면 실험(기본 꺼짐, 웹·앱 공용) ─────────
// 배정 · 대표 장면 고르기 · 다음 행동 판정만 둔다. 문구는 retireExperimentView(실험군 화면 청크),
// 계측은 retireExpMetrics. 설계는 docs/tracking/retire-scenes-experiment-plan.md.
import type { CareerRecord } from '@offside/game/types';

/** 실험 이름. 다음 실험은 이름을 바꿔 배정을 새로 섞는다. 계측 이벤트의 exp_id로도 보낸다. */
export const RETIRE_EXP_ID = 'retire_scenes_v1';
/** 서버 밸런스 키(@offside/contracts/balance). 실험군 비율이자 대조군 비율(0이면 꺼짐, 최대 0.5). */
export const RETIRE_EXP_KEY = 'retireExpShare';

export type RetireArm = 'treatment' | 'control';

/** FNV-1a 32비트. 웹 · 앱이 같은 문자열에 같은 값을 낸다(암호용 아님, 고르게 나누기만). */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 참여 여부 칸(0~9999). 군과 다른 해시라 비율을 바꿔도 군이 따라 바뀌지 않는다. */
export const retireBucket = (profileId: string): number =>
  fnv1a(`${RETIRE_EXP_ID}:in:${profileId}`) % 10_000;

/** 군 해시. 비율과 상관없이 프로필마다 50:50으로 고정이다. */
export const retireArmOf = (profileId: string): RetireArm =>
  fnv1a(`${RETIRE_EXP_ID}:arm:${profileId}`) % 2 === 0 ? 'treatment' : 'control';

/**
 * 프로필 ID로 고정 배정한다. 참여 해시 칸이 2·share(전체 참여율) 안이면 실험에 들어가고, 군은 따로 고정된
 * 군 해시(50:50)로 정한다. 그래서 실험군 ≈ share, 대조군 ≈ share, 나머지는 실험 밖(null)이고, 비율을 올리거나
 * 내려도 이미 들어간 사람의 군은 뒤집히지 않는다(비율을 내리면 실험 밖으로 빠질 수만 있다).
 * ID가 없거나 share가 0 · 잘못된 값이면 실험 밖이다. 실험 밖은 지금 화면 그대로이고 실험 계측도 남기지 않는다.
 * 기기 난수 · 은퇴마다 다시 뽑기를 쓰지 않으므로 같은 프로필은 웹 · 앱 · 다음 은퇴에서도 같은 군이다.
 */
export function retireArm(
  profileId: string | null | undefined,
  share: number | null | undefined,
): RetireArm | null {
  if (!profileId || typeof share !== 'number' || !Number.isFinite(share) || share <= 0) return null;
  const cut = Math.round(Math.min(share, 0.5) * 2 * 10_000);
  return retireBucket(profileId) < cut ? retireArmOf(profileId) : null;
}

/**
 * 이 기기 로컬 기록에서 계정이 바뀌었는지만 가리는 짧은 키(FNV 32비트). 익명화 · 비식별 처리가 아니라 단순 로컬
 * 계정 구분용이며, 이 키는 기기 밖(계측)으로 보내지 않는다.
 */
export const profileKey = (profileId: string | null | undefined): string | null =>
  profileId ? fnv1a(`pk:${profileId}`).toString(36) : null;

// ───────── 대표 장면 ─────────

export type RetireSceneKind = 'first_apps' | 'peak_rating' | 'last_apps';
export type RetireScene = { kind: RetireSceneKind; index: number; rec: CareerRecord };

/**
 * 저장된 시즌 기록(GameState.career)에서 최대 세 장면을 고른다. 출전이 1경기 이상인 시즌만 본다.
 * - first_apps: 출전 기록이 있는 첫 시즌(고교 · 프로를 가리지 않는다. '프로 데뷔'라 부르지 않는다).
 * - peak_rating: 평점이 가장 높은 시즌(같으면 앞 시즌). 평점이 0이면 뺀다.
 * - last_apps: 출전 기록이 있는 마지막 시즌.
 * 같은 시즌을 가리키면 하나만 남기고 시즌 순서로 돌려준다. 출전 시즌이 없으면 빈 배열.
 */
export function pickRetireScenes(career: readonly CareerRecord[]): RetireScene[] {
  const played: { rec: CareerRecord; index: number }[] = [];
  career.forEach((rec, index) => {
    if (rec && Number.isFinite(rec.apps) && rec.apps > 0) played.push({ rec, index });
  });
  if (!played.length) return [];
  const first = played[0]!;
  const last = played[played.length - 1]!;
  let peak: (typeof played)[number] | null = null;
  for (const p of played) {
    const r = Number.isFinite(p.rec.rating) ? p.rec.rating : 0;
    if (r > 0 && (!peak || r > peak.rec.rating)) peak = p;
  }
  const picks: RetireScene[] = [{ kind: 'first_apps', ...first }];
  if (peak && peak.index !== first.index && peak.index !== last.index)
    picks.push({ kind: 'peak_rating', ...peak });
  if (last.index !== first.index) picks.push({ kind: 'last_apps', ...last });
  return picks.sort((a, b) => a.index - b.index);
}

// ───────── 다음 행동 ─────────

export type RetireAccount = 'member' | 'guest' | 'unknown';
export type RetireUpload = 'done' | 'pending' | 'sending' | 'rejected';
/** team: 내 팀 편성으로 · login: 로그인(구단주 화면) · club: 구단주 화면 · null: 버튼 없음. */
export type RetireCta = 'team' | 'login' | 'club';
export type RetireNextKind = 'team' | 'login' | 'club' | 'wait' | 'blocked';

/**
 * 방금 은퇴한 선수가 내 구단에서 어떻게 쓰이는지. 기기 안 업로드 상태 · 계정 확인 결과만 쓴다(서버에 묻지 않는다).
 * 아직 올라가지 않은 기록을 올라갔다고, 로그인 전 상태를 로그인했다고 말하지 않는다.
 */
export function retireNextStep(
  account: RetireAccount,
  upload: RetireUpload,
): { kind: RetireNextKind; cta: RetireCta | null } {
  if (upload === 'rejected') return { kind: 'blocked', cta: null };
  if (upload !== 'done') return { kind: 'wait', cta: 'club' };
  if (account === 'member') return { kind: 'team', cta: 'team' };
  if (account === 'guest') return { kind: 'login', cta: 'login' };
  return { kind: 'club', cta: 'club' };
}

// ───────── 군 정하기(화면 공용) ─────────
type AccountLike = { id: string; linked: { google: boolean; apple: boolean } };

/** 계정 확인 결과 → 다음 행동 판정용 상태. 확인 중 · 연결 실패는 unknown(로그인 여부를 단정하지 않는다). */
export function retireAccount(p: AccountLike | null | 'error' | undefined): RetireAccount {
  if (p === null) return 'guest';
  if (!p || p === 'error') return 'unknown';
  return p.linked.google || p.linked.apple ? 'member' : 'guest';
}

/** 서버 최신 밸런스의 실험 비율(못 받았으면 기본값 0 = 꺼짐). 커리어에 저장된 BAL이 아니라 latest를 읽는다. */
export const retireExpShare = (latest: { values: Record<string, unknown> }): number => {
  const v = latest.values[RETIRE_EXP_KEY];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

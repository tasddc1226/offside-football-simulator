// T-11-648 감독 커리어 3 이적시장: 영입 후보 · 제안 · 판매 등록 · 방출 · 재계약 · 내 선수에게 오는 제안.
import { M3_ROLES, M3_SQUAD_MAX, M3_SQUAD_MIN, M3_TARGETS, type M3Role } from './rules.js';
import {
  clamp,
  clubsOf,
  gauss,
  leagueOf,
  makePlayer,
  M3_LEAGUES,
  pickOf,
  playerValue,
  ri,
  wageFor,
  type R,
} from './people.js';
import { autoLineup } from './match.js';
import type { M3Player, M3State, M3Target } from './types.js';

/** 주전 11명 평균(지금 포메이션 자동 추천). */
export function starterAvg(s: M3State): number {
  const ids = autoLineup(s.squad, s.plan.formation);
  const xs = ids.map((id) => s.squad.find((p) => p.id === id)?.ovr ?? 40);
  return xs.reduce((t, x) => t + x, 0) / xs.length;
}

/** 가장 약한 역할(주전 기준) 셋 — 영입 후보가 이 역할로 많이 나온다. */
function needs(s: M3State): M3Role[] {
  const best = (role: M3Role) =>
    Math.max(0, ...s.squad.filter((p) => p.role === role && p.inj === 0).map((p) => p.ovr));
  return [...M3_ROLES].sort((a, b) => best(a) - best(b)).slice(0, 3);
}

/** 선수 보는 눈으로 흐린 범위. 눈이 좋을수록 좁고 가운데가 진짜 값에 가깝다. */
function blur(r: R, v: number, eye: number, wide = 1): [number, number] {
  const w = Math.max(0, Math.round(((100 - eye) / 12) * wide));
  const c = v + Math.round(gauss(r) * w * 0.5);
  return [clamp(c - w, 30, 99), clamp(c + w, 30, 99)];
}

/** 이적시장 후보 8명(둘은 자유 계약). 수락 확률은 명성 · 구단 등급 차이로 정한다. */
export function makeTargets(s: M3State, r: R): M3Target[] {
  const club = s.club!;
  const myTier = leagueOf(club.leagueId).tier;
  const avg = starterAvg(s);
  const want = needs(s);
  const out: M3Target[] = [];
  for (let i = 0; i < M3_TARGETS; i++) {
    const free = i >= M3_TARGETS - 2;
    const role = r() < 0.6 ? pickOf(r, want) : pickOf(r, M3_ROLES);
    const L = pickOf(
      r,
      M3_LEAGUES.filter((l) => Math.abs(l.tier - myTier) <= 1 && clubsOf(l.id).length),
    );
    const from = free
      ? null
      : pickOf(
          r,
          clubsOf(L.id).filter((c) => c.id !== club.id),
        );
    const age = free ? ri(r, 27, 34) : ri(r, 18, 31);
    const ovr = avg + (free ? -3 : 0) + gauss(r) * 3 + (r() < 0.25 ? 4 : 0);
    const pot = ovr + (age <= 22 ? 3 + r() * 10 : age <= 25 ? r() * 4 : 0);
    const player = makePlayer(s, r, {
      role,
      age,
      ovr,
      pot,
      leagueId: from?.leagueId ?? club.leagueId,
    });
    player.contract = free ? ri(r, 1, 2) : ri(r, 2, 4);
    player.wage = wageFor(player, leagueOf(club.leagueId).wealth);
    const fee = free ? 0 : Math.round((playerValue(player) * (1 + r() * 0.5)) / 100) * 100;
    const [ovrLo, ovrHi] = blur(r, player.ovr, s.attrs.eye);
    const [potLo, potHi] = blur(r, player.pot, s.attrs.eye, 1.6);
    const fromTier = from ? leagueOf(from.leagueId).tier : myTier;
    const willing = clamp(
      0.55 + (myTier - fromTier) * 0.15 + (s.rep - 50) / 200 + (free ? 0.2 : 0),
      0.08,
      0.95,
    );
    out.push({ player, fromClub: from?.name ?? null, fee, ovrLo, ovrHi, potLo, potHi, willing });
  }
  return out;
}

export type BidResult = 'signed' | 'refused' | 'money' | 'full' | 'none';

/** 영입 제안(요구 금액 그대로). 돈 · 선수단 자리가 있으면 수락 확률로 정하고, 거절하면 후보에서 빠진다. */
export function bid(s: M3State, i: number, r: R): BidResult {
  const t = s.targets[i];
  if (!t || !s.club || s.phase !== 'window') return 'none';
  if (s.squad.length >= M3_SQUAD_MAX) return 'full';
  if (t.fee > s.club.budget) return 'money';
  s.targets.splice(i, 1);
  if (r() >= t.willing) return 'refused';
  s.club.budget -= t.fee;
  s.squad.push({ ...t.player, morale: 70 });
  return 'signed';
}

/** 판매 등록(희망가, 기본 몸값) · 해제. 창이 닫힐 때 제안이 오면 팔린다. */
export function listPlayer(s: M3State, id: number, price?: number | null): boolean {
  const p = s.squad.find((x) => x.id === id);
  if (!p || s.phase !== 'window') return false;
  p.listed = price === null ? null : Math.max(100, Math.round(price ?? playerValue(p)));
  return true;
}

/** 방출: 남은 계약 주급의 절반을 위약금으로 낸다. 선수단 최소 인원 아래로는 못 내보낸다. */
export function releasePlayer(s: M3State, id: number): boolean {
  const i = s.squad.findIndex((x) => x.id === id);
  if (i < 0 || !s.club || s.squad.length <= M3_SQUAD_MIN) return false;
  const p = s.squad[i]!;
  s.club.budget = Math.max(0, s.club.budget - Math.round((p.wage * p.contract) / 2));
  s.squad.splice(i, 1);
  return true;
}

/** 재계약 요구 주급: 지금 주급과 몸값 기준 주급 중 큰 쪽에 10~30%(충성 선수는 덜). */
export function renewWage(s: M3State, p: M3Player): number {
  const fair = wageFor(p, leagueOf(s.club!.leagueId).wealth);
  const up = p.trait === 'loyal' ? 1.05 : 1.2;
  return Math.round((Math.max(p.wage, fair) * up) / 100) * 100;
}

/** 재계약(3시즌). 이적 · 리뷰 단계에서만. */
export function renewPlayer(s: M3State, id: number): boolean {
  const p = s.squad.find((x) => x.id === id);
  if (!p || !s.club || (s.phase !== 'window' && s.phase !== 'review')) return false;
  p.wage = renewWage(s, p);
  p.contract = Math.max(p.contract, 3);
  p.morale = clamp(p.morale + 5, 0, 100);
  if (s.review) s.review.expiring = s.review.expiring.filter((x) => x !== id);
  return true;
}

/** 이적시장이 열릴 때 다른 구단이 내 주전을 노리는 제안(없을 수도). */
export function incomingBids(s: M3State, r: R): M3State['bids'] {
  const top = [...s.squad].sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  const out: M3State['bids'] = [];
  for (const p of top) {
    if (r() > 0.12 + (p.age <= 24 ? 0.08 : 0)) continue;
    const tier = leagueOf(s.club!.leagueId).tier;
    const L = pickOf(
      r,
      M3_LEAGUES.filter((l) => l.tier >= tier && clubsOf(l.id).length),
    );
    const c = pickOf(r, clubsOf(L.id));
    out.push({
      player: p.id,
      fee: Math.round((playerValue(p) * (1.1 + r() * 0.5)) / 100) * 100,
      club: c.name,
    });
    if (out.length >= 2) break;
  }
  return out;
}

/** 내 선수에게 온 제안에 답한다. 거절하면 그 선수 사기가 떨어진다(어리면 더). */
export function answerBid(s: M3State, i: number, accept: boolean): boolean {
  const b = s.bids[i];
  if (!b || !s.club) return false;
  s.bids.splice(i, 1);
  const p = s.squad.find((x) => x.id === b.player);
  if (!p) return true;
  if (accept && s.squad.length > M3_SQUAD_MIN) {
    s.club.budget += b.fee;
    s.squad = s.squad.filter((x) => x.id !== p.id);
    s.board = clamp(s.board + 2, 0, 100);
    s.fans = clamp(s.fans - 3, 0, 100);
  } else {
    p.morale = clamp(p.morale - (p.age <= 24 ? 10 : 6), 0, 100);
  }
  return true;
}

/** 창을 닫으며 판매 등록 선수를 처리한다(희망가가 몸값보다 비쌀수록 안 팔린다). 팔린 선수 이름 목록. */
export function settleSales(s: M3State, r: R): string[] {
  const sold: string[] = [];
  for (const p of [...s.squad]) {
    if (p.listed === null || s.squad.length <= M3_SQUAD_MIN) continue;
    const ratio = p.listed / playerValue(p);
    const prob = clamp(0.85 - (ratio - 1) * 0.9, 0.05, 0.9);
    if (r() < prob) {
      s.club!.budget += p.listed;
      s.squad = s.squad.filter((x) => x.id !== p.id);
      sold.push(p.name);
    } else p.listed = null;
  }
  return sold;
}

/** 시즌 주급 합. */
export const wageBill = (s: M3State) => s.squad.reduce((t, p) => t + p.wage, 0);

// ───────── 익명으로 은퇴한 내 선수 이름 공개 (웹·앱 공용, T-11-266) ─────────
// 은퇴할 때 '선수 이름 공개'가 꺼져 있었으면 서버엔 이름 없이 올라가 카드·이적시장·명예의 전당에서 익명으로 보인다.
// 이름은 이 기기(ft_names·ft_hof)에만 남아 있어, 라커룸에서 기기가 아는 이름을 한꺼번에 서버로 보낸다. 이미 이적시장에서
// 팔린 카드도 키운 사람이 이름을 붙이면 산 사람 화면에 이름이 보인다.
import type { AnonCareerIdsResponse, PutCareerNamesResponse } from '@offside/contracts';
import { toPublicName } from '@offside/contracts/content-filter';
import { loadHOF } from '@offside/game/hof-store';
import { saveKey } from '@offside/game/storage';
import { apiFetch, cachedGet } from './api/client.js';

/** 한 번에 보내는 수(contracts CAREER_NAMES_MAX와 같다 — zod 없이 쓰려고 숫자로 둔다). */
const CHUNK = 100;

export type AnonName = { careerId: string; publicName: string };

/** 서버에 이름이 없는 내 선수 id 중 이 기기가 공개할 수 있는 이름을 아는 것. */
export function anonOwnNames(
  ids: readonly string[],
  local: ReadonlyMap<string, string>,
): AnonName[] {
  return ids.flatMap((careerId) => {
    const name = local.get(careerId);
    const publicName = name ? toPublicName(name) : null;
    return publicName ? [{ careerId, publicName }] : [];
  });
}

/**
 * 이름 없이 올라간 내 선수(팔았거나 방출한 선수 포함)를 서버에서 받아 이 기기가 아는 이름과 맞춘다. 이적시장에 팔린 카드는
 * 라커룸 목록에 없어서 서버 목록을 따로 본다. 기기가 아는 이름이 없으면 부르지 않는다. 실패하면 빈 목록(안내만 안 뜬다).
 */
export async function loadAnonNames(local: ReadonlyMap<string, string>): Promise<AnonName[]> {
  if (!local.size) return [];
  const r = await cachedGet<AnonCareerIdsResponse>('/v1/careers/mine/anonymous', 10 * 60_000);
  return r.ok ? anonOwnNames(r.data.ids, local) : [];
}

/** 나눠 보내고 실제로 이름이 붙은 수를 돌려준다(하나라도 실패하면 null). 이 기기 명예의 전당 항목도 공개로 맞춘다. */
export async function publishAnonNames(items: readonly AnonName[]): Promise<number | null> {
  let updated = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const r = await apiFetch<PutCareerNamesResponse>('/v1/careers/public-names', {
      method: 'PUT',
      body: JSON.stringify({ items: items.slice(i, i + CHUNK) }),
    });
    if (!r.ok) return null;
    updated += r.data.updated;
  }
  const ids = new Set(items.map((x) => x.careerId));
  const hof = loadHOF();
  if (hof.some((h) => h.id && ids.has(h.id) && !h.public)) {
    saveKey(
      'ft_hof',
      hof.map((h) => (h.id && ids.has(h.id) ? { ...h, public: true } : h)),
    );
  }
  return updated;
}

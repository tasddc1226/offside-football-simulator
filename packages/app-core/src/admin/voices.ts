// T-11-802 운영 도구 '유저 의견' 탭(웹 admin/AdminVoices.svelte · 앱 settings/admin/AdminVoices.tsx 공용). 운영 도구는 한국어.
// 목록은 탭을 열 때 · 필터 · 더 보기 · 새로고침 때만 부르고, 처리한 뒤에는 다시 부르지 않고 그 행만 바꾸거나 뺀다.
import type { AdminVoice, AdminVoiceList } from '@offside/contracts';
import { VOICE_RESOLVE_MAX, type VoiceKind } from '@offside/contracts/voice';
import { resolveVoices } from '../api/admin.js';
import { kstParts } from '../boardText.js';

export const VOICE_TAB = '유저 의견';
export const VOICE_KIND_NAME: Record<VoiceKind, string> = {
  bug: '버그 · 불편',
  idea: '건의',
  other: '기타',
};
const PLATFORM: Record<string, string> = { web: '웹', ios: 'iOS', android: 'Android' };
const SCREEN: Record<string, string> = { settings: '설정', home: '홈' };
const LANG: Record<string, string> = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어' };
const kstTime = (iso: string) => {
  const p = kstParts(iso);
  return `${p.day} ${p.time}`;
};

/** 운영 탭의 버튼 · 필터 글자(웹 · 앱이 같은 글자를 쓴다). */
export const VOICE_UI = {
  refresh: '새로고침',
  statusLabel: '상태',
  kindLabel: '종류',
  open: '열린 것',
  all: '전체',
  onlyProfile: '이 프로필만',
  profileFiltering: ' 프로필의 의견만 보는 중',
  clearProfile: '전체 보기',
  resolve: '처리',
  reopen: '다시 열기',
  resolved: '처리함',
  more: '더 보기',
  copied: '프로필 id를 복사했어요',
} as const;
export const voiceCopyLabel = (id: string) => `프로필 id ${voiceProfileShort(id)} 복사`;
export const voiceResolveAllLabel = (n: number) =>
  `보이는 열린 의견 모두 처리(${n.toLocaleString()})`;

export const VOICE_NOTE = '본문의 메일 · 전화번호 · 복구 코드는 저장할 때 가렸어요.';
export const VOICE_LOAD_FAIL = '의견을 불러오지 못했어요.';
export const voiceOpenCount = (n: number) => `열린 의견 ${n.toLocaleString()}`;
export const voiceEmpty = (status: 'open' | 'all') =>
  status === 'open' ? '열린 의견이 없어요.' : '의견이 없어요.';
export const voiceConfirmAll = (n: number) => `${n.toLocaleString()}건을 처리할까요?`;
/** 바뀐 것이 없으면(다른 운영자가 먼저 처리 · 다시 열기) '0건 처리했어요' 대신 이미 그 상태라고 알린다. */
export const voiceResolvedToast = (n: number, resolved: boolean) => {
  if (n === 0) return resolved ? '이미 처리된 의견이에요' : '이미 열린 의견이에요';
  return resolved ? `${n.toLocaleString()}건 처리했어요` : '다시 열었어요';
};

/** 본문 아래 회색 줄: KST 시각 · 웹/iOS/Android · 버전 · 기기 · 입구(설정/홈) · 언어 · 로그인 구단주/익명. */
export function voiceMeta(v: AdminVoice): string {
  return [
    kstTime(v.createdAt),
    PLATFORM[v.platform] ?? v.platform,
    v.version,
    v.device,
    v.screen && (SCREEN[v.screen] ?? v.screen),
    LANG[v.lang] ?? v.lang,
    v.linked ? '로그인 구단주' : '익명',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** 프로필 id 앞 8자(prf_ 뒤). 누르면 전체 id를 복사해 유저 조회 탭에 붙여 넣는다. */
export const voiceProfileShort = (id: string) => id.replace(/^prf_/, '').slice(0, 8);

/**
 * 처리 · 다시 열기를 50개씩 차례로 보낸다('보이는 열린 의견 모두 처리'). 실패하면 거기서 멈추고, 그때까지 바뀐 수와 서버 문구를
 * 돌려준다.
 */
export async function resolveVoicesAll(
  ids: string[],
  resolved: boolean,
): Promise<{ ok: true; updated: number } | { ok: false; updated: number; message: string }> {
  let updated = 0;
  for (let i = 0; i < ids.length; i += VOICE_RESOLVE_MAX) {
    const r = await resolveVoices({ ids: ids.slice(i, i + VOICE_RESOLVE_MAX), resolved });
    if (!r.ok) return { ok: false, updated, message: r.error.message };
    updated += r.data.updated;
  }
  return { ok: true, updated };
}

/**
 * 처리 결과를 목록에 반영한다. 열린 것만 보는 중에 처리했으면 그 행을 빼고, 전체를 보는 중이면 처리 시각만 바꾼다. 열린 건수는
 * 실제로 바뀐 수(updated)만큼 맞춘다.
 */
export function applyVoiceResolve(
  list: AdminVoiceList,
  change: { ids: string[]; resolved: boolean; updated: number; at: string },
  status: 'open' | 'all',
): AdminVoiceList {
  const hit = new Set(change.ids);
  const items =
    status === 'open' && change.resolved
      ? list.items.filter((v) => !hit.has(v.id))
      : list.items.map((v) =>
          hit.has(v.id)
            ? { ...v, resolvedAt: change.resolved ? (v.resolvedAt ?? change.at) : null }
            : v,
        );
  const open = list.open + (change.resolved ? -change.updated : change.updated);
  return { ...list, items, open: Math.max(0, open) };
}

/**
 * '더 보기'로 받은 다음 쪽을 붙인다. 이미 있는 id는 거른다(같은 쪽을 두 번 받아도 같은 행이 두 번 보이지 않는다). 열린 건수 ·
 * hasMore는 새 쪽 값을 쓴다.
 */
export function mergeVoicePage(list: AdminVoiceList, page: AdminVoiceList): AdminVoiceList {
  const seen = new Set(list.items.map((v) => v.id));
  return { ...page, items: [...list.items, ...page.items.filter((v) => !seen.has(v.id))] };
}

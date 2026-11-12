// T-11-700 엑솔라 파트너 네트워크(크리에이터 수익 공유). 크리에이터 링크로 들어오면 주소에 tracking_id(32자)가 붙는다.
// 이 값을 이 브라우저에 남겨 두었다가 웹 결제 주문에 실어야 그 결제가 크리에이터 실적으로 잡힌다. 엑솔라 스크립트를
// 불러오지 않고 같은 일을 직접 한다(외부 스크립트를 늘리지 않는다). 값은 링크 식별자일 뿐 사람을 가리키지 않는다.
import { loadKey, saveKey } from '@offside/game/storage';

const KEY = 'ft_creator_tracking';
/** T-11-703 링크로 들어왔는데 아직 서버(프로필)에 묶지 못한 값. 묶으면 지운다. */
const PENDING_KEY = 'ft_creator_tracking_pending';
const FORMAT = /^[A-Za-z0-9]{32}$/;

/** 부팅 때 한 번. 주소에 추적값이 있으면 남긴다(다른 크리에이터 링크로 다시 오면 새 값으로 바뀐다). */
export function detectCreatorTracking(href = location.href) {
  try {
    const id = new URL(href).searchParams.get('tracking_id');
    if (id && FORMAT.test(id)) {
      saveKey(KEY, id);
      saveKey(PENDING_KEY, id);
    }
  } catch {
    /* 주소를 못 읽으면 남기지 않는다. */
  }
}

type Sent = { ok: boolean; error?: { retryable?: boolean } };
/** 이번 탭에서 이미 보낸 프로필(같은 프로필로는 다시 보내지 않는다). */
const sentTo = new Set<string>();

/**
 * T-11-703 묶지 못한 값이 있으면 지금 프로필로 서버에 보낸다. 계정을 확인할 때마다 부른다. 로그인 전 익명 프로필에도 보내 두고,
 * 로그인한(구단주) 프로필에 묶이면 다시 보내지 않는다 — 웹 결제는 로그인한 구단주만 하므로 거기에 묶여야 한다.
 */
export async function syncCreatorTracking(
  profile: { id: string; linked: boolean } | null,
  send: (trackingId: string) => Promise<Sent>,
) {
  const id = loadKey<string>(PENDING_KEY);
  if (!profile || typeof id !== 'string' || !FORMAT.test(id) || sentTo.has(profile.id)) return;
  sentTo.add(profile.id);
  const r = await send(id);
  if (!r.ok && r.error?.retryable) sentTo.delete(profile.id);
  // 서버가 값을 받지 않으면(형식 등) 다시 보내도 같으니 지운다.
  if ((r.ok && profile.linked) || (!r.ok && !r.error?.retryable)) saveKey(PENDING_KEY, null);
}

/** 서버에 묶지 못한 값이 있는지(없으면 계정 확인에 끼어들지 않는다). */
export const hasPendingCreatorTracking = () => FORMAT.test(String(loadKey<string>(PENDING_KEY)));

/** 남겨 둔 추적값. 없거나 형식이 깨졌으면 null(주문에 싣지 않는다). */
export function creatorTrackingId(): string | null {
  const id = loadKey<string>(KEY);
  return typeof id === 'string' && FORMAT.test(id) ? id : null;
}

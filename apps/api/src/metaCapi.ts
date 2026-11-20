// T-11-769 메타 전환 API(Conversions API). 광고로 들어온 방문이 첫 커리어를 시작하면 서버에서도 메타에 알린다.
// 브라우저 픽셀과 같은 이벤트 ID를 써서 메타가 하나로 합친다. 광고 측정에 동의한 방문만 브라우저가 meta 칸을 보낸다.
// 픽셀이 이미 보내는 것(쿠키 식별자 _fbc · _fbp, IP, 브라우저 정보, 커리어 시작)만 보내고 저장하지 않는다(개인정보처리방침 8항).
// 프로필 · 계정 ID(해시 포함) · 이름 · 이메일 · 커리어 정보는 보내지 않는다(고객 정보 매칭을 쓰지 않는다). 토큰이 없으면(로컬 · 스테이징) 아무것도 하지 않는다.
import type { Context } from 'hono';
import type { AppEnv } from './env.js';
import { waitUntil } from './edgeCache.js';

const GRAPH = 'https://graph.facebook.com/v21.0';
/** 브라우저 픽셀 `fbq('track', 'CompleteRegistration', …, { eventID })`과 같은 표준 이벤트. */
export const META_START_EVENT = 'CompleteRegistration';

export type MetaStart = { eventId: string; fbc?: string; fbp?: string };

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// 쿠키 형식: fb.<서브도메인 인덱스>.<밀리초>.<값>.
const COOKIE = /^fb\.\d\.\d{10,16}\.[\w.-]{1,500}$/;

/** 요청 본문의 meta 칸을 검사한다. 모양이 틀리면 버린다(방문 기록은 그대로 남긴다). */
export function parseMetaStart(raw: unknown): MetaStart | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.eventId !== 'string' || !EVENT_ID.test(m.eventId)) return null;
  const out: MetaStart = { eventId: m.eventId.toLowerCase() };
  if (typeof m.fbc === 'string' && COOKIE.test(m.fbc)) out.fbc = m.fbc;
  if (typeof m.fbp === 'string' && COOKIE.test(m.fbp)) out.fbp = m.fbp;
  return out;
}

/** 메타에 보낼 본문. 테스트가 그대로 검사한다. */
export function metaStartBody(
  start: MetaStart,
  o: {
    at: string;
    ip?: string | undefined;
    ua?: string | undefined;
    testCode?: string | undefined;
  },
) {
  const user: Record<string, unknown> = {};
  if (start.fbc) user.fbc = start.fbc;
  if (start.fbp) user.fbp = start.fbp;
  if (o.ip && o.ip !== 'unknown') user.client_ip_address = o.ip;
  if (o.ua) user.client_user_agent = o.ua.slice(0, 512);
  return {
    data: [
      {
        event_name: META_START_EVENT,
        event_time: Math.floor(Date.parse(o.at) / 1000),
        event_id: start.eventId,
        action_source: 'website',
        event_source_url: 'https://offside-lab.com/',
        user_data: user,
        custom_data: { content_name: 'career_start' },
      },
    ],
    ...(o.testCode ? { test_event_code: o.testCode } : {}),
  };
}

/** 응답을 기다리지 않고 보낸다. 실패해도 방문 기록 · 게임에는 영향이 없다(실패 수만 로그). */
export function sendMetaStart(
  c: Context<AppEnv>,
  start: MetaStart,
  o: { at: string },
  fetcher: typeof fetch = fetch,
) {
  const pixel = c.env.META_PIXEL_ID;
  const token = c.env.META_CAPI_TOKEN;
  if (!pixel || !/^\d{6,20}$/.test(pixel) || !token) return;
  const job = (async () => {
    const body = metaStartBody(start, {
      ...o,
      ip: c.req.header('CF-Connecting-IP'),
      ua: c.req.header('User-Agent'),
      testCode: c.env.META_CAPI_TEST_CODE,
    });
    const res = await fetcher(`${GRAPH}/${pixel}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn(JSON.stringify({ event: 'meta_capi_failed', status: res.status }));
  })().catch(() => console.warn(JSON.stringify({ event: 'meta_capi_failed', status: 0 })));
  waitUntil(c, job);
}

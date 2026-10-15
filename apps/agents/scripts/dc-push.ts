// 디시 마이너 갤러리 글 · 댓글을 읽어 에이전트 Worker에 넣는다(GitHub Actions slack-operations.yml, 매시 27분).
// Cloudflare에서 디시를 읽으면 빈 응답이 잦아 러너에서 읽는다. 커서는 Worker가 갖고, 작성자는 여기서 가명으로 바꾼다.
// 실행: AGENTS_READ_TOKEN=... node apps/agents/scripts/dc-push.ts
import { fetchDc, type DcCursor, type Reaction } from '../src/reactions.ts';

const BASE = process.env.AGENTS_BASE ?? 'https://agents.offside-lab.com';
const token = process.env.AGENTS_READ_TOKEN;
if (!token) {
  console.log('AGENTS_READ_TOKEN이 없어 건너뜀');
  process.exit(0);
}
const call = async <T>(job: string, body?: unknown): Promise<T> => {
  const r = await fetch(`${BASE}/internal/run?job=${job}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`agents ${job} ${r.status}`);
  return r.json() as Promise<T>;
};
const { cursor } = await call<{ cursor: DcCursor | null }>('dc-cursor');
const got: { items: Reaction[]; cursor: DcCursor | undefined } = await fetchDc(
  { AGENTS_READ_TOKEN: token },
  cursor ?? undefined,
  Date.now(),
);
if (!got.cursor) process.exit(0);
const { pending } = await call<{ pending: number }>('dc-push', got);
// 글 내용은 로그에 남기지 않는다(공개 저장소의 Actions 로그).
console.log(`dc: new ${got.items.length}, pending ${pending}`);

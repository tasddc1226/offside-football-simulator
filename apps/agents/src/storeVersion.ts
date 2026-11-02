// T-11-609 스토어 출시 감지. 앱 업데이트 팝업은 서버의 APP_VERSIONS.latest(apps/api/src/routes/appVersion.ts)를 보는데, 이 값은
// 사람이 올린다. 매일 스토어에 공개된 버전과 비교해 다르면 운영 채널에 알린다. 값은 바꾸지 않고, 모델도 부르지 않는다.
// - App Store: 공개 조회 API(사용자가 실제로 받는 버전, 키 불필요)
// - Google Play: 출시 트랙(리뷰와 같은 서비스 계정). 읽으려면 임시 편집을 열어야 해서 저장하지 않고 바로 지운다.
import { chatClient } from './chat.ts';
import type { Env } from './env.ts';
import { serviceAccountToken } from './google.ts';
import { playAccount } from './reviews.ts';

const LOOKUP = 'https://itunes.apple.com/lookup';
const PLAY = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

type Platform = 'ios' | 'android';
const LABEL: Record<Platform, string> = { ios: 'App Store', android: 'Google Play' };

/** `1.2.3` 꼴 버전 비교(a < b면 음수). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export type PlayRelease = { name?: string; status?: string; userFraction?: number };
export type StoreVersion = { version: string; staged?: { version: string; fraction: number } };

const versionOf = (name?: string) => /^\d+\.\d+\.\d+/.exec(name ?? '')?.[0] ?? null;
const highest = (versions: string[]) =>
  [...versions].sort((a, b) => compareVersions(b, a))[0] ?? null;

/** 트랙에서 전체 공개(completed) 최고 버전과 단계적 출시(inProgress)를 고른다. 공개 버전을 못 읽으면 null. */
export function playVersion(releases: PlayRelease[]): StoreVersion | null {
  const version = highest(
    releases
      .filter((r) => r.status === 'completed')
      .map((r) => versionOf(r.name))
      .filter((v): v is string => !!v),
  );
  if (!version) return null;
  const rolling = releases.find((r) => r.status === 'inProgress' && versionOf(r.name));
  return rolling
    ? {
        version,
        staged: { version: versionOf(rolling.name)!, fraction: rolling.userFraction ?? 0 },
      }
    : { version };
}

/** 알릴 줄. 단계적 출시 중인 버전은 전체 공개 전이라 아직 올리라고 하지 않는다. */
export function versionNotes(
  latest: Record<Platform, string>,
  stores: Partial<Record<Platform, StoreVersion>>,
): string[] {
  const out: string[] = [];
  for (const platform of ['ios', 'android'] as const) {
    const store = stores[platform];
    if (!store) continue;
    const order = compareVersions(store.version, latest[platform]);
    if (order > 0)
      out.push(
        `- ${LABEL[platform]}: 스토어는 ${store.version}인데 \`latest\`는 ${latest[platform]}이에요. 올리면 업데이트 팝업이 떠요.`,
      );
    else if (order < 0) {
      const staged = store.staged
        ? ` (${store.staged.version} 단계적 출시 ${Math.round(store.staged.fraction * 100)}%)`
        : '';
      out.push(
        `- ${LABEL[platform]}: 스토어는 ${store.version}${staged}인데 \`latest\`는 ${latest[platform]}이에요. 아직 받을 수 없는 버전을 안내하고 있어요.`,
      );
    }
  }
  return out;
}

async function okJson<T>(r: Response, label: string): Promise<T> {
  if (!r.ok) throw new Error(`${label} ${r.status}`);
  return (await r.json()) as T;
}

async function iosVersion(env: Env, fetcher: typeof fetch): Promise<StoreVersion | null> {
  if (!env.ASC_APP_ID) return null;
  const d = await okJson<{ results?: { version?: string }[] }>(
    await fetcher(`${LOOKUP}?id=${env.ASC_APP_ID}&country=kr`),
    'App Store lookup',
  );
  const version = d.results?.[0]?.version;
  return version ? { version } : null;
}

async function androidVersion(env: Env, fetcher: typeof fetch): Promise<StoreVersion | null> {
  const account = playAccount(env);
  if (!env.PLAY_PACKAGE || !account) return null;
  const token = await serviceAccountToken(account, PLAY_SCOPE, fetcher, 'Google Play 트랙');
  const headers = { Authorization: `Bearer ${token}` };
  const base = `${PLAY}/${env.PLAY_PACKAGE}/edits`;
  const { id } = await okJson<{ id: string }>(
    await fetcher(base, { method: 'POST', headers, body: '{}' }),
    'Play edit',
  );
  try {
    const track = await okJson<{ releases?: PlayRelease[] }>(
      await fetcher(`${base}/${id}/tracks/production`, { headers }),
      'Play track',
    );
    return playVersion(track.releases ?? []);
  } finally {
    await fetcher(`${base}/${id}`, { method: 'DELETE', headers }).catch(() => undefined);
  }
}

/** 한 번 비교한다. dry면 올리지 않는다. 한쪽 스토어를 못 읽어도 다른 쪽은 본다(오류는 돌려주고 알리지 않는다). */
export async function checkStoreVersions(
  env: Env,
  { dry = false, fetcher = fetch }: { dry?: boolean; fetcher?: typeof fetch } = {},
) {
  const { data } = await okJson<{ data: Record<Platform, { latest: string }> }>(
    await fetcher(`${env.API_BASE}/v1/app/version`),
    'app version',
  );
  const errors: string[] = [];
  const read = (label: string, job: Promise<StoreVersion | null>) =>
    job.catch((e: unknown) => {
      errors.push(`${label}: ${String(e).slice(0, 120)}`);
      return null;
    });
  const [ios, android] = await Promise.all([
    read('ios', iosVersion(env, fetcher)),
    read('android', androidVersion(env, fetcher)),
  ]);
  const notes = versionNotes(
    { ios: data.ios.latest, android: data.android.latest },
    { ...(ios ? { ios } : {}), ...(android ? { android } : {}) },
  );
  if (notes.length && !dry)
    await chatClient(env, 'ops')('chat.postMessage', {
      channel: env.DESK_CHANNEL,
      text: `*스토어 버전과 앱 안내 버전이 달라요*\n${notes.join('\n')}\n\`apps/api/src/routes/appVersion.ts\`의 \`APP_VERSIONS\`를 고쳐 배포해 주세요.`,
    });
  return { ios, android, notes, errors };
}

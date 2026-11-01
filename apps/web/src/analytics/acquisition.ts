import {
  apiAuth,
  apiBaseUrl,
  getProfile,
  hasSessionHint,
  cachedGet,
  invalidateApiCache,
} from '@offside/app-core/api/client';
import { CONSENT_KEY } from '@offside/app-core/analytics-model';
import { entryCampaign as landing } from './entry-campaign.js';
import { consentByDefault } from '../consent-region.js';
import {
  clearOAuthCampaign,
  oauthMeasurementAllowed,
  oauthCampaignCurrent,
  withdrawOAuthCampaign,
  rememberOAuthCampaign,
  takeOAuthCampaign,
  oauthEntryCampaign,
  restoreOAuthEntry,
  resetOAuthEntry,
  type OAuthProvider,
} from './oauth-campaign.js';
import {
  ACQUISITION_CONSENT_VERSION as version,
  ACQUISITION_SESSION_MS,
} from '@offside/contracts/acquisition';
const SESSION_KEY = 'offside_acquisition_session_v1';
const REVOKE_KEY = 'offside_acquisition_revoke_v1';
const PROFILE_KEY = 'offside_acquisition_profile_v1';
const UNRESOLVED = 'unresolved';
const CHOICE_KEY = 'offside_acquisition_choice_v1';
export const acquisitionEnabled = () => import.meta.env.VITE_ACQUISITION_ENABLED === 'true';
let profileId: string | null = null;
let granted = false;
let blocked = false;
let epoch = 0;
let queue = Promise.resolve();
let wireQueue = Promise.resolve();
const oauthContext =
  acquisitionEnabled() && typeof location !== 'undefined' ? takeOAuthCampaign(location.href) : null;
let oauthResolution: Promise<void> | undefined;
let continuationProfile: string | null = null;
let continuationCancelled = false;
function clearContinuation() {
  clearOAuthCampaign();
  continuationCancelled = true;
  continuationProfile = null;
  resetOAuthEntry();
}
function checkContinuation(account: string) {
  if (
    continuationProfile &&
    (continuationProfile !== account || !oauthContext || !oauthCampaignCurrent(oauthContext.at))
  )
    clearContinuation();
}
async function resolveOAuthCampaign() {
  if (!oauthContext) return;
  oauthResolution ??= (async () => {
    // URL flags alone never prove a login. Read the current authenticated server profile.
    const me = await getProfile();
    if (
      !me.ok ||
      continuationCancelled ||
      !me.data.linked[oauthContext.provider] ||
      !oauthCampaignCurrent(oauthContext.at)
    )
      return;
    // A continuation is a new visit, never a transfer/replay of the old profile's touch/events.
    sessionStorage.removeItem(SESSION_KEY);
    continuationProfile = me.data.id;
    restoreOAuthEntry(oauthContext.campaign);
    invalidateApiCache('/v1/acquisition/consent');
  })().catch(() => {});
  await oauthResolution;
}
/** Called only at an explicit web login action, after its current profile was read. */
export async function prepareAcquisitionOAuth(provider: OAuthProvider, account: string) {
  clearOAuthCampaign();
  if (!acquisitionEnabled() || !acquisitionGranted()) return;
  try {
    const generation = epoch;
    const response = await request();
    const state = response.ok
      ? ((await response.json()) as { profileId: string; granted: boolean })
      : null;
    rememberOAuthCampaign(
      provider,
      oauthEntryCampaign(landing),
      !!state?.granted &&
        state.profileId === account &&
        generation === epoch &&
        acquisitionGranted(),
    );
  } catch {
    clearOAuthCampaign();
  } // Optional measurement must never prevent login.
}
function analyticsAllowed() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}
async function request(action?: Record<string, unknown>, activeEpoch?: number) {
  const auth = apiAuth();
  const perform = () => {
    if (action?.action === 'grant' && activeEpoch !== epoch)
      return Promise.resolve(new Response(null, { status: 409 }));
    return fetch(`${apiBaseUrl()}/v1/acquisition${action ? '' : '/consent'}`, {
      ...auth,
      method: action ? 'POST' : 'GET',
      signal: AbortSignal.timeout(10_000),
      headers: { ...auth.headers, 'Content-Type': 'application/json' },
      ...(action ? { body: JSON.stringify({ version, ...action }) } : {}),
    });
  };
  if (!action) {
    const result = await cachedGet<{
      profileId: string;
      granted: boolean;
      revision: string | null;
    }>('/v1/acquisition/consent', 30_000);
    return result.ok
      ? Response.json(result.data)
      : new Response(null, { status: result.error.code === 'PROFILE_REQUIRED' ? 401 : 503 });
  }
  const result = wireQueue.then(perform).then((response) => {
    if (response.ok || response.status === 409) invalidateApiCache('/v1/acquisition/consent');
    return response;
  });
  wireQueue = result.then(
    () => {},
    () => {},
  );
  return result;
}
export function acquisitionWithdrawalPending() {
  try {
    return !!localStorage.getItem(REVOKE_KEY);
  } catch {
    return false;
  }
}
export function acquisitionGranted() {
  return granted && !blocked && analyticsAllowed();
}
export async function acquisitionStatus(): Promise<'granted' | 'denied' | 'unknown'> {
  if (!acquisitionEnabled()) return 'denied';
  const generation = epoch;
  try {
    if (oauthContext) await resolveOAuthCampaign();
    const pending = localStorage.getItem(REVOKE_KEY);
    if (pending) {
      blocked = true;
      // No account identity was available offline. Keep the request pending rather than
      // applying it to a possibly different account. An explicit retry resolves it.
      if (pending === UNRESOLVED) return 'denied';
      if (!(await request({ action: 'revoke', profileId: pending })).ok) return 'denied';
      localStorage.removeItem(REVOKE_KEY);
      blocked = false;
    }
    if (!analyticsAllowed() || localStorage.getItem(CHOICE_KEY) === 'denied') return 'denied';
    if (!hasSessionHint()) return 'unknown';
    const response = await request();
    if (!response.ok) {
      granted = false;
      return 'unknown';
    }
    const state = (await response.json()) as {
      profileId: string;
      granted: boolean;
      revision: string | null;
    };
    if (generation !== epoch || !analyticsAllowed()) return 'denied';
    // T-11-597 알린 뒤 기본으로 켜는 지역에서 이 프로필이 한 번도 고른 적이 없으면(서버 기록 없음) 켠다.
    // 철회한 프로필은 서버에 철회 표식(revision)이 남아 있어 다시 켜지 않는다.
    if (
      !state.granted &&
      state.revision === null &&
      consentByDefault() &&
      localStorage.getItem(CHOICE_KEY) === null
    )
      return (await setAcquisitionConsent('granted')) ? 'granted' : 'unknown';
    checkContinuation(state.profileId);
    if (profileId && profileId !== state.profileId) sessionStorage.removeItem(SESSION_KEY);
    profileId = state.profileId;
    localStorage.setItem(PROFILE_KEY, profileId);
    granted = state.granted;
    if (granted) recordAcquisition('session');
    return granted
      ? 'granted'
      : localStorage.getItem(CHOICE_KEY) === 'denied'
        ? 'denied'
        : 'unknown';
  } catch {
    granted = false;
    return 'unknown';
  }
}
export async function setAcquisitionConsent(value: 'granted' | 'denied'): Promise<boolean> {
  const generation = ++epoch;
  granted = false;
  if (value === 'denied') {
    withdrawOAuthCampaign();
    clearContinuation();
  }
  try {
    if (value === 'denied') {
      blocked = true;
      localStorage.setItem(CHOICE_KEY, 'denied');
      const knownProfile = profileId ?? localStorage.getItem(PROFILE_KEY);
      // Persist before any network operation; reload/offline cannot lose withdrawal.
      localStorage.setItem(REVOKE_KEY, knownProfile ?? UNRESOLVED);
      sessionStorage.removeItem(SESSION_KEY);
      profileId = knownProfile;
      if (!profileId) {
        // This explicit withdrawal may check an existing httpOnly session even when
        // browser storage (and its hint) was cleared; it never creates a profile.
        const res = await request();
        if (res.status === 401) {
          localStorage.removeItem(REVOKE_KEY);
          return true;
        }
        if (!res.ok) return false;
        profileId = ((await res.json()) as { profileId: string }).profileId;
      }
      localStorage.setItem(REVOKE_KEY, profileId!);
      await queue;
      if (!(await request({ action: 'revoke', profileId })).ok) return false;
      localStorage.removeItem(REVOKE_KEY);
      return true;
    }
    if (!acquisitionEnabled() || !analyticsAllowed()) return false;
    if (oauthContext) await resolveOAuthCampaign();
    if (generation !== epoch || !analyticsAllowed()) return false;
    // Only an explicit choice can create a profile. No forced login.
    const me = await getProfile();
    if (!me.ok || generation !== epoch || !analyticsAllowed()) return false;
    const expectedProfile = me.data.id;
    checkContinuation(expectedProfile);
    const pending = localStorage.getItem(REVOKE_KEY);
    if (pending) {
      if (pending === UNRESOLVED) return false;
      if (!(await request({ action: 'revoke', profileId: pending })).ok) return false;
      localStorage.removeItem(REVOKE_KEY);
    }
    if (generation !== epoch || !analyticsAllowed()) return false;
    profileId = expectedProfile;
    localStorage.setItem(PROFILE_KEY, expectedProfile);
    const consent = await request();
    if (!consent.ok || generation !== epoch || !analyticsAllowed()) return false;
    const current = (await consent.json()) as { profileId: string; revision: string | null };
    if (current.profileId !== expectedProfile) return false;
    const response = await request(
      { action: 'grant', profileId: expectedProfile, revision: current.revision ?? null },
      generation,
    );
    if (!response.ok || generation !== epoch || !analyticsAllowed()) return false;
    profileId = ((await response.json()) as { profileId: string }).profileId;
    localStorage.setItem(PROFILE_KEY, profileId);
    localStorage.removeItem(REVOKE_KEY);
    localStorage.setItem(CHOICE_KEY, 'granted');
    blocked = false;
    granted = true;
    recordAcquisition('session');
    return true;
  } catch {
    return false;
  }
}
export function recordAcquisition(action: 'session' | 'start' | 'store_click') {
  if (!acquisitionEnabled() || !acquisitionGranted()) return;
  const generation = epoch;
  queue = queue.then(async () => {
    if (generation !== epoch || !acquisitionGranted()) return;
    try {
      checkContinuation(profileId!);
      const campaign = oauthEntryCampaign(landing);
      const now = Date.now();
      let session = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as {
        id: string;
        profile: string;
        campaign: string;
        at: number;
        sent?: string[];
      } | null;
      if (
        !session ||
        session.profile !== profileId ||
        now - session.at >= ACQUISITION_SESSION_MS ||
        session.at > now ||
        (campaign && session.campaign !== campaign)
      ) {
        session = { id: crypto.randomUUID(), profile: profileId!, campaign, at: now };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      // T-11-502 서버는 세션마다 행동별 첫 시각만 남기므로(coalesce) 이 세션에서 이미 받은 행동은 다시 보내지 않는다.
      // 홈에 돌아올 때마다 'session'을 다시 보내던 요청이 세션당 행동 하나에 한 번으로 준다.
      if (session.sent?.includes(action)) return;
      const res = await request({
        action,
        profileId: session.profile,
        sessionId: session.id,
        campaign: session.campaign,
      });
      if (res.ok) {
        session.sent = [...(session.sent ?? []), action];
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else if (res.status === 409 || res.status === 401) {
        granted = false;
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* Retry only on the next real action. Never block play. */
    }
  });
}
if (typeof window !== 'undefined' && acquisitionEnabled())
  window.addEventListener('storage', (e) => {
    if (e.key === CONSENT_KEY || e.key === REVOKE_KEY || e.key === CHOICE_KEY || e.key === null) {
      epoch++;
      granted = false;
      // A denied→granted pair can queue before this tab runs. Keep the event's withdrawal,
      // even when localStorage already contains the later grant by the time we handle it.
      const withdrawal =
        e.key === null ||
        ((e.key === CONSENT_KEY || e.key === CHOICE_KEY) && e.newValue !== 'granted') ||
        (e.key === REVOKE_KEY && e.newValue !== null);
      if (withdrawal || !analyticsAllowed() || localStorage.getItem(CHOICE_KEY) === 'denied')
        blocked = true;
      if (withdrawal || !oauthMeasurementAllowed()) clearContinuation();
    }
  });

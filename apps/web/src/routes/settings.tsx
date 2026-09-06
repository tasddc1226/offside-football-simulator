// SCR-030 설정·데이터. 데이터 섹션(복구 코드·프로필 복구·로그아웃·이 기기 데이터 삭제·프로필 삭제,
// Google 연결)은 T-1-012·T-1-013이 채운다. 채널 문구 분기는 platform이 주는 값으로만 한다(lint
// noChannelBranchRules) — 이 화면은 채널별 문구가 필요 없는 부분만 다룬다.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  buttonClassName,
  buttonStyle,
  Card,
  Dialog,
  DialogContent,
  DialogTrigger,
  Disclosure,
  RadioGroup,
  RadioGroupItem,
  ScreenIntro,
  Toast,
} from '@offside/ui';
import { ENGINE_CLIENT_VERSION } from '@offside/engine-client';
import {
  RecoveryConflictDetailsSchema,
  type ErrorCode,
  type MergeChoice,
  type Profile,
} from '@offside/contracts';
import type { SimulationMode } from '@offside/domain';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  API_BASE_URL,
  confirmProfileDeletion,
  getProfile,
  issueRecoveryCode,
  logout,
  recoverProfile,
  startProfileDeletion,
  submitGoogleMerge,
  unlinkGoogle,
} from '../api/client.js';
import { ensureProfile } from '../api/profile.js';
import { activeContentPack, activeRuleset } from '../engine/content.js';
import { getAppEngine } from '../engine/engine.js';
import { prepareGoogleConnect } from '../engine/google-connect.js';
import { retryPendingDeletes } from '../engine/pending-delete.js';
import { reconcileAfterRecovery } from '../engine/reconcile.js';
import { getSyncClient, requeueAllUnsynced } from '../engine/sync.js';
import { useCareerList } from '../engine/use-career.js';
import { useSyncSummary } from '../engine/use-sync.js';
import { platform } from '../platform/index.js';
import { APP_VERSION_LABEL } from '../shared/app-version.js';
import { queryClient } from '../shared/query-client.js';
import { useExpandDisclosuresOnHash } from '../shared/expand-disclosures-on-hash.js';
import { formatLocalDate, formatLocalDateTime } from '../shared/format.js';
import { validateRecoveryCodeInput } from '../shared/recovery-code-input.js';
import { SettingsFooter } from '../shared/SettingsFooter.js';
import { SyncBadge } from '../shared/SyncBadge.js';
import { TeamNamesSettings } from '../shared/TeamNamesSettings.js';
import {
  useUiStore,
  type ReducedMotionPreference,
  type TextScale,
  type ThemePreference,
} from '../shared/ui-store.js';

/** `GET /v1/auth/google/callback`이 `/settings`로 되돌려줄 때 붙이는 쿼리(ADR-008). */
type GoogleQueryResult = 'linked' | 'switched' | 'merge_required' | 'error';
const GOOGLE_QUERY_RESULTS: readonly GoogleQueryResult[] = [
  'linked',
  'switched',
  'merge_required',
  'error',
];

function isGoogleQueryResult(value: unknown): value is GoogleQueryResult {
  return typeof value === 'string' && (GOOGLE_QUERY_RESULTS as readonly string[]).includes(value);
}

type SettingsSearch = { google?: GoogleQueryResult; reason?: string };

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
    ...(isGoogleQueryResult(search.google) ? { google: search.google } : {}),
    ...(typeof search.reason === 'string' ? { reason: search.reason } : {}),
  }),
  component: SettingsScreen,
});

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

/**
 * 되돌릴 수 없는 삭제 버튼 색. packages/ui의 Button은 danger variant가 없고 이 작업은 packages/ui를
 * 만질 수 없다 — inline style로 --os-danger 토큰을 얹는다(인라인은 클래스 소스 순서와 무관하게
 * 항상 우선한다).
 */
const DANGER_STYLE: CSSProperties = { color: 'var(--os-danger)', borderColor: 'var(--os-danger)' };

const PROFILE_ID_KV_KEY = 'profile:id';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'SYSTEM', label: '시스템 설정' },
  { value: 'LIGHT', label: '라이트' },
  { value: 'DARK', label: '다크' },
];

const REDUCED_MOTION_OPTIONS: Array<{ value: ReducedMotionPreference; label: string }> = [
  { value: 'SYSTEM', label: '시스템 설정' },
  { value: 'ON', label: '켜기' },
  { value: 'OFF', label: '끄기' },
];

const TEXT_SCALE_OPTIONS: Array<{ value: TextScale; label: string }> = [
  { value: 100, label: '100%' },
  { value: 125, label: '125%' },
  { value: 150, label: '150%' },
];

const SIMULATION_MODE_OPTIONS: Array<{ value: SimulationMode; label: string }> = [
  { value: 'FAST', label: '빠르게' },
  { value: 'CHAPTER', label: '챕터로 자세히' },
];

/** FAILED 코드별 안내. 목록에 없으면 "서버가 저장을 거부했습니다(코드)". */
const FAILED_CODE_MESSAGE: Partial<Record<ErrorCode, string>> = {
  VERSION_MISMATCH: '앱을 새로고침해 최신 버전을 받으세요',
  CAREER_ARCHIVED: '보관된 커리어는 더 저장하지 않습니다',
};

/** `?google=error&reason=` 값별 안내(auth.ts의 redirectToSettings 사유와 맞춘다). */
const GOOGLE_ERROR_REASON_MESSAGE: Record<string, string> = {
  state: '연결 요청이 만료됐습니다. 다시 시도해 주세요.',
  exchange: 'Google 인증에 실패했습니다. 다시 시도해 주세요.',
  cancelled: 'Google 연결을 취소했습니다.',
};

function googleErrorMessage(reason: string | undefined): string {
  return (
    (reason !== undefined ? GOOGLE_ERROR_REASON_MESSAGE[reason] : undefined) ??
    'Google 연결에 실패했습니다. 다시 시도해 주세요.'
  );
}

function SyncStatusRow() {
  const summary = useSyncSummary();
  const [syncing, setSyncing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const sync = await getSyncClient();
      await sync.flush();
    } finally {
      setSyncing(false);
    }
  }

  async function handleReconnect() {
    setReconnecting(true);
    try {
      const engine = await getAppEngine();
      const ok = await ensureProfile(engine.store, queryClient);
      if (ok) {
        await requeueAllUnsynced();
        // 세션이 없어(401) 큐에 남아 있던 삭제도 세션을 되찾은 지금 함께 다시 시도한다.
        await retryPendingDeletes(engine.store);
        // 이 기기가 LOCAL_ONLY였던 동안 서버에만 생긴 커리어를 받아온다(D-20 대조, choice: NONE —
        // 로컬 커리어는 지우지 않고 미전송분만 알린다).
        await reconcileAfterRecovery('NONE', queryClient);
      }
    } finally {
      setReconnecting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-os-3">
      <div className="flex items-center justify-between gap-os-3">
        <span className="font-os text-os-text">동기화 상태</span>
        <SyncBadge state={summary} />
      </div>

      <Button variant="secondary" onClick={() => void handleSyncNow()} disabled={syncing}>
        지금 동기화
      </Button>

      {summary.kind === 'LOCAL_ONLY' ? (
        <div className="flex flex-col gap-os-2">
          <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
            이 브라우저에서는 서버 저장을 할 수 없습니다. 쿠키가 차단됐거나 세션이 없습니다. 복구
            코드 없이 브라우저 데이터를 지우면 되돌릴 수 없습니다.
          </p>
          <Button
            variant="secondary"
            onClick={() => void handleReconnect()}
            disabled={reconnecting}
          >
            다시 연결
          </Button>
        </div>
      ) : null}

      {summary.kind === 'FAILED' ? (
        <p className="font-os text-os-danger" style={CAPTION_STYLE}>
          {FAILED_CODE_MESSAGE[summary.error.code] ??
            `서버가 저장을 거부했습니다(${summary.error.code})`}
        </p>
      ) : null}
    </Card>
  );
}

/** `['profile']`은 부트스트랩(main.tsx의 ensureProfile)이 채우고, 이 훅은 그 캐시를 읽고 신선하게 유지한다. */
function useProfileQuery() {
  return useQuery({
    queryKey: ['profile'] as const,
    queryFn: async (): Promise<Profile> => {
      const result = await getProfile();
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
  });
}

function RecoveryCodeRow() {
  const profileQuery = useProfileQuery();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const issuedAt = profileQuery.data?.recoveryCodeIssuedAt ?? null;

  async function handleIssue() {
    setIssuing(true);
    setIssueError(null);
    try {
      const result = await issueRecoveryCode();
      if (result.ok) {
        setConfirmOpen(false);
        setIssuedCode(result.data.code);
        platform.analytics.track('recovery_code_issued', {});
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
      } else if (result.error.code === 'RATE_LIMITED') {
        setIssueError('발급 횟수를 넘었습니다. 잠시 뒤 다시 시도하세요.');
      } else {
        setIssueError(result.error.message);
      }
    } finally {
      setIssuing(false);
    }
  }

  function handleTriggerClick() {
    // 재발급(이전 코드가 있음)만 "이전 코드는 즉시 쓸 수 없게 됩니다" 확인이 필요하다. 첫 발급은
    // 무효화할 이전 코드가 없어 바로 발급한다.
    if (issuedAt !== null) {
      setConfirmOpen(true);
      return;
    }
    void handleIssue();
  }

  async function handleCopy() {
    if (issuedCode === null) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
    } catch {
      // 복사 실패는 대화상자에 코드가 그대로 보이니 조용히 무시한다.
    }
  }

  return (
    <Card className="flex flex-col gap-os-3">
      <div className="flex items-center justify-between gap-os-3">
        <div className="flex flex-col gap-os-1">
          <span className="font-os text-os-text">복구 코드</span>
          <span className="font-os text-os-text-2" style={CAPTION_STYLE}>
            {issuedAt !== null ? (
              <>
                발급일 <time dateTime={issuedAt}>{formatLocalDate(issuedAt)}</time>
              </>
            ) : (
              '아직 없음'
            )}
          </span>
        </div>
        <Button variant="secondary" onClick={handleTriggerClick} disabled={issuing}>
          {issuedAt !== null ? '재발급' : '발급'}
        </Button>
      </div>

      {issueError !== null ? (
        <p className="font-os text-os-danger" style={CAPTION_STYLE}>
          {issueError}
        </p>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (issuing) return;
          setConfirmOpen(open);
        }}
      >
        <DialogContent
          title="복구 코드 재발급"
          description="이전 코드는 즉시 쓸 수 없게 됩니다. 새 코드를 적어 두세요."
          closeLabel="닫기"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (issuing) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (issuing) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (issuing) event.preventDefault();
          }}
        >
          <div className="flex gap-os-3">
            <button
              ref={cancelRef}
              type="button"
              className={buttonClassName('ghost')}
              style={buttonStyle}
              onClick={() => setConfirmOpen(false)}
              disabled={issuing}
            >
              취소
            </button>
            <Button variant="primary" onClick={() => void handleIssue()} disabled={issuing}>
              재발급
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={issuedCode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIssuedCode(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent title="복구 코드" closeLabel="닫기">
          <div className="flex flex-col gap-os-3">
            <p className="os-num font-os font-bold text-os-text" style={H2_STYLE}>
              {issuedCode}
            </p>
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              다른 기기에서 이 프로필을 되찾는 방법 중 하나입니다. 안전한 곳에 적어 두세요. 이미
              연결한 Google 계정으로도 돌아올 수 있습니다.
            </p>
            <div className="flex gap-os-3">
              <Button variant="secondary" onClick={() => void handleCopy()}>
                복사
              </Button>
              <Button variant="primary" onClick={() => setIssuedCode(null)}>
                적어 두었습니다
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {copied ? (
        <Toast variant="success" message="복사했습니다" onDismiss={() => setCopied(false)} />
      ) : null}
    </Card>
  );
}

type ConflictState = { code: string; currentCareerCount: number; targetCareerCount: number };

function ProfileRecoverRow() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const conflictCancelRef = useRef<HTMLButtonElement>(null);

  async function attemptRecover(normalizedCode: string, mergeChoice?: MergeChoice) {
    setBusy(true);
    setError(null);
    try {
      const result = await recoverProfile(
        mergeChoice !== undefined
          ? { code: normalizedCode, mergeChoice }
          : { code: normalizedCode },
      );
      if (result.ok) {
        setConflict(null);
        const engine = await getAppEngine();
        await engine.store.transaction('readwrite', (tx) =>
          tx.kv.put(PROFILE_ID_KV_KEY, result.data.profileId),
        );
        const reconciled = await reconcileAfterRecovery(mergeChoice ?? 'NONE', queryClient);
        // reconcileAfterRecovery도 실패 경로에서 invalidateQueries를 부르지만, 이 시점엔 세션이 이미
        // 새 프로필로 바뀌어 있으니 ['profile']만은 결과와 무관하게 한 번 더 확실히 갱신해 둔다.
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        platform.analytics.track('profile_recovered', { mergeChoice: mergeChoice ?? 'NONE' });
        setCode('');
        setToast(
          reconciled.ok
            ? {
                variant: 'success',
                message: `프로필을 복구했습니다. 커리어 ${result.data.careerCount}개`,
              }
            : {
                // packages/ui의 Toast는 success·error 2종뿐이라(warning 없음, packages/ui는 수정 범위
                // 밖) error 변형을 대신 쓴다 — 계정 전환 자체는 됐지만 커리어 목록을 마저 못 받아온
                // 상태임을 알린다.
                variant: 'error',
                message:
                  '프로필은 복구했지만 커리어 목록을 불러오지 못했습니다. 설정의 다시 연결로 다시 시도하세요.',
              },
        );
        return;
      }

      if (result.error.code === 'RECOVERY_CONFLICT') {
        const parsed = RecoveryConflictDetailsSchema.safeParse(result.error.details);
        if (parsed.success) {
          setConflict({ code: normalizedCode, ...parsed.data });
        } else {
          setError(result.error.message);
        }
        return;
      }
      if (result.error.code === 'RECOVERY_CODE_INVALID') {
        setError('코드가 맞지 않습니다.');
      } else if (result.error.code === 'RATE_LIMITED') {
        setError('시도 횟수를 넘었습니다. 잠시 뒤 다시 시도하세요.');
      } else {
        setError(result.error.message);
      }
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateRecoveryCodeInput(code);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    void attemptRecover(validation.normalized);
  }

  return (
    <Card className="flex flex-col gap-os-3">
      <Disclosure summary="프로필 복구">
        <form onSubmit={handleSubmit} className="flex flex-col gap-os-2">
          <label
            htmlFor="recover-code-input"
            className="font-os text-os-text-2"
            style={CAPTION_STYLE}
          >
            다른 기기에서 발급받은 복구 코드
          </label>
          <input
            id="recover-code-input"
            ref={inputRef}
            type="text"
            autoComplete="off"
            inputMode="text"
            placeholder="OFS-XXXX-XXXX-XXXX"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            aria-invalid={error !== null}
            aria-describedby={error !== null ? 'recover-code-error' : undefined}
            className="os-num rounded-os-m border border-os-border bg-os-surface px-os-3 font-os text-os-text"
            style={buttonStyle}
          />
          {error !== null ? (
            <p id="recover-code-error" className="font-os text-os-danger" style={CAPTION_STYLE}>
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy}>
            복구
          </Button>
        </form>
      </Disclosure>

      <Dialog
        open={conflict !== null}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) setConflict(null);
        }}
      >
        <DialogContent
          title="이미 커리어가 있는 기기입니다"
          description="이 기기의 커리어와 복구할 프로필의 커리어 중 무엇을 남길지 골라 주세요."
          closeLabel="닫기"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            conflictCancelRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {conflict !== null ? (
            <div className="flex flex-col gap-os-3">
              <Button
                variant="secondary"
                onClick={() => void attemptRecover(conflict.code, 'MOVE_TO_LINKED')}
                disabled={busy}
              >
                이 기기의 커리어 {conflict.currentCareerCount}개를 복구할 프로필로 옮기기
              </Button>
              <Button
                variant="secondary"
                style={DANGER_STYLE}
                onClick={() => void attemptRecover(conflict.code, 'KEEP_LINKED_ONLY')}
                disabled={busy}
              >
                복구할 프로필(커리어 {conflict.targetCareerCount}개)만 사용하고 이 기기의 커리어는
                지우기
              </Button>
              <button
                ref={conflictCancelRef}
                type="button"
                className={buttonClassName('ghost')}
                style={buttonStyle}
                onClick={() => setConflict(null)}
                disabled={busy}
              >
                취소
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {toast !== null ? (
        <Toast
          variant={toast.variant}
          message={toast.message}
          onDismiss={() => {
            setToast(null);
            void navigate({ to: '/' });
          }}
        />
      ) : null}
    </Card>
  );
}

/**
 * T-1-013 D-21: Google 연결 행. toss는 `platform.features.googleLink`로만 걸러 다른 문구를 보여준다
 * (채널 리터럴 비교 금지, lint noChannelBranchRules). 콜백이 되돌려주는 `?google=` 쿼리 처리와 대기
 * 병합(`pendingMerge`) 재안내를 이 컴포넌트가 함께 맡는다(ADR-008).
 */
function GoogleRow() {
  const profileQuery = useProfileQuery();
  const careerQuery = useCareerList();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [mergeDismissed, setMergeDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ variant: 'success' | 'error'; message: string } | null>(
    null,
  );
  const unlinkCancelRef = useRef<HTMLButtonElement>(null);
  const mergeCancelRef = useRef<HTMLButtonElement>(null);
  const connectInFlightRef = useRef(false);

  const googleLinked = profileQuery.data?.linked.google === true;
  const googleEmailMasked = profileQuery.data?.googleEmailMasked ?? null;
  const pendingMerge = profileQuery.data?.pendingMerge ?? null;
  const noRecoveryCode = (profileQuery.data?.recoveryCodeIssuedAt ?? null) === null;
  const localCareerCount = (careerQuery.data ?? []).length;
  const unsyncedLocalCareerCount = (careerQuery.data ?? []).filter(
    ({ record }) => record.revision > record.lastSyncedRevision,
  ).length;
  const mergeDialogOpen = pendingMerge !== null && !mergeDismissed;

  function clearGoogleQuery() {
    void navigate({ to: '/settings', search: {}, replace: true });
  }

  // search.google 값이 바뀔 때만 처리한다(clearGoogleQuery 등 다른 클로저는 매 렌더 새로 만들어져
  // 의존성 배열에 넣으면 무한 반복이 된다).
  useEffect(() => {
    if (search.google === undefined) return;
    if (search.google === 'linked') {
      platform.analytics.track('google_link_result', { result: 'linked' });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setToast({ variant: 'success', message: 'Google을 연결했습니다' });
      clearGoogleQuery();
      return;
    }
    if (search.google === 'switched') {
      platform.analytics.track('google_link_result', { result: 'switched' });
      void (async () => {
        const engine = await getAppEngine();
        await ensureProfile(engine.store, queryClient);
        const reconciled = await reconcileAfterRecovery('NONE', queryClient);
        setToast(
          reconciled.ok
            ? { variant: 'success', message: 'Google에 연결된 프로필로 바꿨습니다' }
            : {
                variant: 'error',
                message:
                  '프로필은 바꿨지만 커리어 목록을 불러오지 못했습니다. 설정의 다시 연결로 다시 시도하세요.',
              },
        );
      })();
      clearGoogleQuery();
      return;
    }
    if (search.google === 'merge_required') {
      platform.analytics.track('google_link_result', { result: 'merge_required' });
      setMergeDismissed(false);
      clearGoogleQuery();
      return;
    }
    platform.analytics.track('google_link_result', { result: 'error' });
    setToast({ variant: 'error', message: googleErrorMessage(search.reason) });
    clearGoogleQuery();
  }, [search.google]);

  async function handleConnect() {
    if (connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    setBusy(true);
    setError(null);
    platform.analytics.track('google_link_started');
    const prepared = await prepareGoogleConnect();
    if (!prepared.ok) {
      setError(prepared.message);
      setBusy(false);
      connectInFlightRef.current = false;
      return;
    }
    try {
      platform.openExternal(`${API_BASE_URL}/v1/auth/google/start`);
    } catch {
      setError('Google 연결 화면을 열지 못했습니다. 다시 시도해 주세요.');
      setBusy(false);
      connectInFlightRef.current = false;
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setError(null);
    try {
      const result = await unlinkGoogle();
      if (result.ok) {
        setUnlinkOpen(false);
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        platform.analytics.track('google_unlinked');
      } else {
        setError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMergeChoice(choice: MergeChoice) {
    setBusy(true);
    setError(null);
    try {
      const result = await submitGoogleMerge(choice);
      if (result.ok) {
        const engine = await getAppEngine();
        await engine.store.transaction('readwrite', (tx) =>
          tx.kv.put(PROFILE_ID_KV_KEY, result.data.profileId),
        );
        const reconciled = await reconcileAfterRecovery(choice, queryClient);
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        platform.analytics.track('google_merge_resolved', { mergeChoice: choice });
        setToast(
          reconciled.ok
            ? {
                variant: 'success',
                message: `Google 프로필과 합쳤습니다. 커리어 ${result.data.careerCount}개`,
              }
            : {
                variant: 'error',
                message:
                  '연결은 됐지만 커리어 목록을 불러오지 못했습니다. 설정의 다시 연결로 다시 시도하세요.',
              },
        );
        return;
      }
      setError(result.error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!platform.features.googleLink) {
    return (
      <Card className="flex items-center justify-between gap-os-3">
        <span className="font-os text-os-text">Google 연결</span>
        <span className="font-os text-os-text-2" style={CAPTION_STYLE}>
          이 채널의 계정으로 자동 저장됩니다
        </span>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-os-2">
      <div className="flex items-center justify-between gap-os-3">
        <div className="flex flex-col gap-os-1">
          <span className="font-os text-os-text">Google 연결</span>
          {googleLinked && googleEmailMasked !== null ? (
            <span className="os-num font-os text-os-text-2" style={CAPTION_STYLE}>
              {googleEmailMasked}
            </span>
          ) : null}
        </div>

        {googleLinked ? (
          <Dialog
            open={unlinkOpen}
            onOpenChange={(open) => {
              if (busy) return;
              setUnlinkOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary" style={DANGER_STYLE}>
                연결 해제
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Google 연결 해제"
              closeLabel="닫기"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                unlinkCancelRef.current?.focus();
              }}
              onEscapeKeyDown={(event) => {
                if (busy) event.preventDefault();
              }}
              onPointerDownOutside={(event) => {
                if (busy) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              <div className="flex flex-col gap-os-3">
                <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                  Google 연결을 해제하면 이 계정으로 다시 찾아올 수 없습니다.
                </p>
                {noRecoveryCode ? (
                  <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                    복구 코드가 없어 연결을 해제하면 이 프로필을 되돌릴 방법이 없습니다.
                  </p>
                ) : null}
                {error !== null ? (
                  <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                    {error}
                  </p>
                ) : null}
                <div className="flex gap-os-3">
                  <button
                    ref={unlinkCancelRef}
                    type="button"
                    className={buttonClassName('ghost')}
                    style={buttonStyle}
                    onClick={() => setUnlinkOpen(false)}
                    disabled={busy}
                  >
                    취소
                  </button>
                  <Button
                    variant="secondary"
                    style={DANGER_STYLE}
                    onClick={() => void handleUnlink()}
                    disabled={busy}
                  >
                    연결 해제
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Button variant="secondary" onClick={() => void handleConnect()} disabled={busy}>
            {busy ? '저장 확인 중' : 'Google로 연결'}
          </Button>
        )}
      </div>

      {error !== null && !mergeDialogOpen && !unlinkOpen ? (
        <p role="alert" className="font-os text-os-danger" style={CAPTION_STYLE}>
          {error}
        </p>
      ) : null}

      <Dialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) setMergeDismissed(true);
        }}
      >
        <DialogContent
          title="Google에 연결된 프로필이 있습니다"
          description="이 기기의 커리어를 Google 프로필로 옮길지, 이 기기에서는 Google 프로필의 저장본만 사용할지 골라 주세요. 원래 익명 프로필의 서버 데이터는 여기서 삭제되지 않습니다."
          closeLabel="닫기"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            mergeCancelRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {pendingMerge !== null ? (
            <div className="flex flex-col gap-os-3">
              {error !== null ? (
                <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                  {error}
                </p>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => void handleMergeChoice('MOVE_TO_LINKED')}
                disabled={busy}
              >
                이 기기의 커리어 {localCareerCount}개를 보존하며 Google 프로필로 전환하기
              </Button>
              {unsyncedLocalCareerCount > 0 ? (
                <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                  이 기기에 아직 서버에 저장되지 않은 진행 {unsyncedLocalCareerCount}개가 있습니다.
                  Google 저장본만 사용하면 로컬 전용 커리어는 삭제되고, 같은 ID의 진행은 Google 서버
                  저장본으로 교체됩니다. 보존하려면 위의 전환을 선택하세요.
                </p>
              ) : null}
              <Button
                variant="secondary"
                style={DANGER_STYLE}
                onClick={() => void handleMergeChoice('KEEP_LINKED_ONLY')}
                disabled={busy}
              >
                이 기기에서 Google 프로필(커리어 {pendingMerge.targetCareerCount}개)의 저장본만
                사용하기
              </Button>
              <button
                ref={mergeCancelRef}
                type="button"
                className={buttonClassName('ghost')}
                style={buttonStyle}
                onClick={() => setMergeDismissed(true)}
                disabled={busy}
              >
                취소
              </button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {toast !== null ? (
        <Toast variant={toast.variant} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </Card>
  );
}

function LogoutRow() {
  const profileQuery = useProfileQuery();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const canLogout = profileQuery.data?.linked.google === true;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await logout();
      if (result.ok) {
        setOpen(false);
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        platform.analytics.track('logout');
        setToast('로그아웃했습니다. 이 기기의 진행은 그대로 남습니다');
      } else {
        setError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-os-2">
      <div className="flex items-center justify-between gap-os-3">
        <span className="font-os text-os-text">로그아웃</span>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (busy) return;
            setOpen(next);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="secondary" disabled={!canLogout}>
              로그아웃
            </Button>
          </DialogTrigger>
          <DialogContent
            title="로그아웃"
            description="이 기기의 진행은 그대로 남습니다. 다시 Google로 연결하면 이 프로필로 돌아올 수 있습니다."
            closeLabel="닫기"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (busy) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <div className="flex flex-col gap-os-3">
              {error !== null ? (
                <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                  {error}
                </p>
              ) : null}
              <div className="flex gap-os-3">
                <button
                  ref={cancelRef}
                  type="button"
                  className={buttonClassName('ghost')}
                  style={buttonStyle}
                  onClick={() => setOpen(false)}
                  disabled={busy}
                >
                  취소
                </button>
                <Button
                  variant="secondary"
                  style={DANGER_STYLE}
                  onClick={() => void handleConfirm()}
                  disabled={busy}
                >
                  로그아웃
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Disclosure summary="자세히">
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          Google을 연결한 프로필에서만 쓸 수 있습니다. 로그아웃해도 이 기기의 진행은 남고, 다시
          Google로 연결하면 같은 프로필로 돌아올 수 있습니다.
        </p>
      </Disclosure>
      {toast !== null ? (
        <Toast variant="success" message={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </Card>
  );
}

/** 이 기기 데이터 삭제 실행부. "이 기기 데이터 삭제"·"프로필 삭제" 2단계가 공유한다(D-20). */
async function clearThisDeviceAndGoToOnboarding(): Promise<void> {
  try {
    const sync = await getSyncClient();
    await sync.flush();
  } catch {
    // 브리프: "flush() 시도(실패 무시)" — 저장 못한 진행이 있어도 삭제는 계속한다.
  }
  const engine = await getAppEngine();
  await engine.store.close();
  await platform.clearLocalData();
  platform.analytics.track('local_data_cleared', {});
  // 엔진·동기화 싱글턴이 다음 로드에서 새로 만들어지도록 SPA 이동이 아니라 전체 새로고침으로 이동한다.
  location.assign('/onboarding');
}

function DeleteProfileRow() {
  const [stage, setStage] = useState<'idle' | 'confirm'>('idle');
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      const result = await startProfileDeletion();
      if (result.ok) {
        setConfirmToken(result.data.confirmToken);
        setExpiresAt(result.data.expiresAt);
        setStage('confirm');
      } else {
        setError(result.error.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (confirmToken === null) return;
    setBusy(true);
    try {
      const result = await confirmProfileDeletion(confirmToken);
      if (result.ok) {
        platform.analytics.track('profile_deleted', {});
        await clearThisDeviceAndGoToOnboarding();
        return;
      }
      setStage('idle');
      setConfirmToken(null);
      setExpiresAt(null);
      setError(
        result.error.code === 'VALIDATION_FAILED'
          ? '확인 시간이 지났습니다. 다시 시작해 주세요.'
          : result.error.message,
      );
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (busy) return;
    setStage('idle');
    setConfirmToken(null);
    setExpiresAt(null);
  }

  return (
    <Card className="flex flex-col gap-os-2">
      <div className="flex items-center justify-between gap-os-3">
        <span className="font-os text-os-text">프로필 삭제</span>
        <Button
          variant="secondary"
          style={DANGER_STYLE}
          onClick={() => void handleStart()}
          disabled={busy}
        >
          삭제
        </Button>
      </div>
      {error !== null ? (
        <p className="font-os text-os-danger" style={CAPTION_STYLE}>
          {error}
        </p>
      ) : null}

      <Dialog
        open={stage === 'confirm'}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <DialogContent
          title="프로필 삭제"
          closeLabel="닫기"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="flex flex-col gap-os-3">
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              모든 커리어, 복구 코드, 서버 저장 데이터가 즉시 삭제됩니다. 되돌릴 수 없습니다.
            </p>
            {expiresAt !== null ? (
              <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
                이 확인은 <time dateTime={expiresAt}>{formatLocalDateTime(expiresAt)}</time>까지
                유효합니다.
              </p>
            ) : null}
            <div className="flex gap-os-3">
              <button
                ref={cancelRef}
                type="button"
                className={buttonClassName('ghost')}
                style={buttonStyle}
                onClick={handleCancel}
                disabled={busy}
              >
                취소
              </button>
              <Button
                variant="secondary"
                style={DANGER_STYLE}
                onClick={() => void handleConfirm()}
                disabled={busy}
              >
                삭제
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DeleteDeviceDataRow() {
  const profileQuery = useProfileQuery();
  const careerQuery = useCareerList();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const unsentCount = (careerQuery.data ?? []).filter(
    (career) => career.record.revision > career.record.lastSyncedRevision,
  ).length;
  const noRecoveryCode = (profileQuery.data?.recoveryCodeIssuedAt ?? null) === null;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await clearThisDeviceAndGoToOnboarding();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : '데이터를 지우지 못했습니다. 다시 시도해 주세요.',
      );
      setBusy(false);
    }
  }

  return (
    <Card className="flex items-center justify-between gap-os-3">
      <span className="font-os text-os-text">이 기기 데이터 삭제</span>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary" style={DANGER_STYLE}>
            삭제
          </Button>
        </DialogTrigger>
        <DialogContent
          title="이 기기 데이터 삭제"
          closeLabel="닫기"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="flex flex-col gap-os-3">
            <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
              이 기기의 모든 커리어와 설정이 지워집니다. 되돌릴 수 없습니다.
            </p>
            {unsentCount > 0 ? (
              <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                아직 서버에 저장하지 못한 커리어가 {unsentCount}개 있습니다. 지우면 그 진행은
                사라집니다.
              </p>
            ) : null}
            {noRecoveryCode ? (
              <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                복구 코드가 없어 되돌릴 수 없습니다.
              </p>
            ) : null}
            {error !== null ? (
              <p className="font-os text-os-danger" style={CAPTION_STYLE}>
                {error}
              </p>
            ) : null}
            <div className="flex gap-os-3">
              <button
                ref={cancelRef}
                type="button"
                className={buttonClassName('ghost')}
                style={buttonStyle}
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                취소
              </button>
              <Button
                variant="secondary"
                style={DANGER_STYLE}
                onClick={() => void handleConfirm()}
                disabled={busy}
              >
                삭제
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettingsScreen() {
  const theme = useUiStore((state) => state.theme);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const textScale = useUiStore((state) => state.textScale);
  const defaultSimulationMode = useUiStore((state) => state.defaultSimulationMode);
  const setTheme = useUiStore((state) => state.setTheme);
  const setReducedMotion = useUiStore((state) => state.setReducedMotion);
  const setTextScale = useUiStore((state) => state.setTextScale);
  const setDefaultSimulationMode = useUiStore((state) => state.setDefaultSimulationMode);

  useEffect(() => {
    platform.analytics.track('screen_viewed', { screenId: 'SCR-030', careerPhase: 'NONE' });
  }, []);
  // 접힌 Disclosure(프로필 복구·로그아웃 설명·버전·데이터 위험 작업) 안으로 향하는 상단 빠른 이동
  // 앵커를 자동으로 펼친다.
  useExpandDisclosuresOnHash();

  return (
    <div className="os-screen os-settings">
      <ScreenIntro
        eyebrow="MY OFFSIDE"
        title="설정"
        description="계정과 저장 상태를 먼저 확인하고, 플레이 환경을 나에게 맞게 바꾸세요."
      />
      <nav className="os-segmented overflow-x-auto" aria-label="설정 빠른 이동">
        <a
          href="#settings-account"
          className="flex min-h-[48px] items-center px-os-3 font-os font-semibold text-os-text"
        >
          계정·저장
        </a>
        <a
          href="#settings-presentation"
          className="flex min-h-[48px] items-center px-os-3 font-os font-semibold text-os-text"
        >
          표시·접근성
        </a>
        <a
          href="#settings-play"
          className="flex min-h-[48px] items-center px-os-3 font-os font-semibold text-os-text"
        >
          플레이
        </a>
        <a
          href="#settings-team-names"
          className="flex min-h-[48px] items-center px-os-3 font-os font-semibold text-os-text"
        >
          구단 이름
        </a>
        <a
          href="#settings-safety"
          className="flex min-h-[48px] items-center px-os-3 font-os font-semibold text-os-text"
        >
          데이터 관리
        </a>
      </nav>
      <div className="flex flex-col gap-os-6">
        <section
          id="settings-account"
          className="flex scroll-mt-20 flex-col gap-os-3"
          aria-labelledby="settings-account-title"
        >
          <h2 id="settings-account-title" className="os-section-title">
            계정·저장
          </h2>
          <SyncStatusRow />
          <RecoveryCodeRow />
          <ProfileRecoverRow />
          <GoogleRow />
          <LogoutRow />
        </section>

        <section
          id="settings-presentation"
          className="flex scroll-mt-20 flex-col gap-os-5"
          aria-labelledby="settings-presentation-title"
        >
          <h2 id="settings-presentation-title" className="os-section-title">
            표시·접근성
          </h2>
          <section className="flex flex-col gap-os-3">
            <h2 id="settings-theme" className="font-os font-semibold text-os-text" style={H2_STYLE}>
              테마
            </h2>
            <RadioGroup
              className="os-segmented"
              aria-labelledby="settings-theme"
              value={theme}
              onValueChange={(value) => setTheme(value as ThemePreference)}
            >
              {THEME_OPTIONS.map((option) => (
                <RadioGroupItem key={option.value} value={option.value}>
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </section>

          <section className="flex flex-col gap-os-3">
            <h2
              id="settings-reduced-motion"
              className="font-os font-semibold text-os-text"
              style={H2_STYLE}
            >
              모션 감소
            </h2>
            <RadioGroup
              className="os-segmented"
              aria-labelledby="settings-reduced-motion"
              value={reducedMotion}
              onValueChange={(value) => setReducedMotion(value as ReducedMotionPreference)}
            >
              {REDUCED_MOTION_OPTIONS.map((option) => (
                <RadioGroupItem key={option.value} value={option.value}>
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </section>

          <section className="flex flex-col gap-os-3">
            <h2
              id="settings-text-scale"
              className="font-os font-semibold text-os-text"
              style={H2_STYLE}
            >
              텍스트 크기
            </h2>
            <RadioGroup
              className="os-segmented"
              aria-labelledby="settings-text-scale"
              value={String(textScale)}
              onValueChange={(value) => setTextScale(Number(value) as TextScale)}
            >
              {TEXT_SCALE_OPTIONS.map((option) => (
                <RadioGroupItem key={option.value} value={String(option.value)}>
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </section>
        </section>

        <section
          id="settings-play"
          className="flex scroll-mt-20 flex-col gap-os-5"
          aria-labelledby="settings-play-title"
        >
          <h2 id="settings-play-title" className="os-section-title">
            플레이
          </h2>
          <section className="flex flex-col gap-os-3">
            <h2
              id="settings-simulation-mode"
              className="font-os font-semibold text-os-text"
              style={H2_STYLE}
            >
              시뮬레이션 기본 모드
            </h2>
            <RadioGroup
              className="os-segmented os-segmented-two"
              aria-labelledby="settings-simulation-mode"
              value={defaultSimulationMode}
              onValueChange={(value) => setDefaultSimulationMode(value as SimulationMode)}
            >
              {SIMULATION_MODE_OPTIONS.map((option) => (
                <RadioGroupItem key={option.value} value={option.value}>
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </section>

          <section className="flex flex-col gap-os-3">
            <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
              온보딩
            </h2>
            <Link to="/onboarding" className={buttonClassName('secondary')} style={buttonStyle}>
              온보딩 다시 보기
            </Link>
          </section>
        </section>

        <TeamNamesSettings />

        <section
          id="settings-safety"
          className="flex scroll-mt-20 flex-col gap-os-5"
          aria-labelledby="settings-safety-title"
        >
          <h2 id="settings-safety-title" className="os-section-title">
            데이터 관리
          </h2>
          <section className="flex flex-col gap-os-3">
            <h2
              id="settings-version"
              className="font-os font-semibold text-os-text"
              style={H2_STYLE}
            >
              버전
            </h2>
            <p className="os-num font-os font-semibold text-os-text" style={CAPTION_STYLE}>
              OFFSIDE {APP_VERSION_LABEL}
            </p>
            <Disclosure summary="상세 버전" aria-labelledby="settings-version">
              <dl
                className="os-num flex flex-col gap-os-1 font-os text-os-text-2 opacity-70"
                style={CAPTION_STYLE}
              >
                <div className="flex justify-between gap-os-2">
                  <dt>룰셋</dt>
                  <dd>{activeRuleset.version}</dd>
                </div>
                <div className="flex justify-between gap-os-2">
                  <dt>콘텐츠 팩</dt>
                  <dd>{activeContentPack.manifest.contentPackVersion}</dd>
                </div>
                <div className="flex justify-between gap-os-2">
                  <dt>엔진 클라이언트</dt>
                  <dd>{ENGINE_CLIENT_VERSION}</dd>
                </div>
              </dl>
            </Disclosure>
          </section>

          <section className="flex flex-col gap-os-3">
            <h2 id="settings-data" className="font-os font-semibold text-os-text" style={H2_STYLE}>
              데이터
            </h2>
            <Disclosure summary="위험 작업 보기" aria-labelledby="settings-data">
              <ul className="flex flex-col gap-os-2">
                <li>
                  <DeleteProfileRow />
                </li>
                <li>
                  <DeleteDeviceDataRow />
                </li>
              </ul>
            </Disclosure>
          </section>
        </section>
      </div>

      <SettingsFooter />

      <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
        허브로
      </Link>
    </div>
  );
}

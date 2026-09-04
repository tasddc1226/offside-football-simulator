// 06 "충돌 해소": 커리어 상태가 CONFLICT가 되면 연다. "다른 기기 진행 가져오기"(REMOTE) ·
// "이 기기 진행 유지"(fork-by-replay) · "나중에" 세 갈래. 실행 중에는 버튼을 전부 잠근다
// (COMMITTING) — 커밋 도중 대화상자를 닫거나 다시 누르면 상태가 어긋난다.
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, CompareCards, Dialog, DialogContent, type CompareCardItem, type CompareRow } from '@offside/ui';
import { forkCareerByReplay, type CareerSyncState, type EngineError } from '@offside/engine-client';
import { CareerStateSchema, type CareerSnapshot } from '@offside/contracts';
import { getAppEngine } from '../engine/engine.js';
import { getSyncClient } from '../engine/sync.js';
import { useCareer } from '../engine/use-career.js';
import { CAREER_STAGE_LABELS, TIMELINE_KIND_LABELS } from './labels.js';
import { platform } from '../platform/index.js';
import { screenForCareer } from './career-route.js';
import { SCREEN_ROUTES } from '../routes.js';

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

export type SyncToast = { variant: 'success' | 'error'; message: string };

type MinimalCareerState = {
  age: number;
  stage: 'YOUTH' | 'PRO';
  timeline: ReadonlyArray<{
    // T-2-002 D-34·T-2-004 D-38·T-3-001: exhaustive union이 typecheck에서 깨져 최소 수정(PR 본문 참고).
    kind:
      | 'CAREER_CONFIRMED'
      | 'EVENT_RESOLVED'
      | 'CONTRACT_SIGNED'
      | 'SEASON_STARTED'
      | 'STEP_PASSED'
      | 'SEASON_SETTLED'
      | 'ROLE_RESOLVED'
      | 'CHAPTER_RESOLVED'
      | 'CAREER_TAG_GRANTED'
      | 'CONTRACT_RENEWED'
      | 'TRANSFERRED'
      | 'LOANED'
      | 'LOAN_RETURNED'
      | 'OFFER_REJECTED'
      | 'OFFER_EXPIRED'
      | 'NEGOTIATED'
      | 'INJURED'
      | 'REHAB_CHOSEN'
      | 'RECOVERED'
      | 'INJURY_RECURRED'
      | 'MANAGER_CHANGED'
      | 'NATIONAL_TEAM_CALLED'
      | 'NATIONAL_TEAM_DECLINED'
      | 'CAPTAIN_APPOINTED';
  }>;
};

function parseServerState(snapshot: CareerSnapshot): MinimalCareerState | null {
  try {
    const parsed: unknown = JSON.parse(snapshot.state);
    const result = CareerStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function lastTimelineLabel(timeline: MinimalCareerState['timeline'] | undefined): string {
  if (timeline === undefined || timeline.length === 0) return '—';
  return TIMELINE_KIND_LABELS[timeline[timeline.length - 1]!.kind];
}

function isForkLogIncomplete(error: EngineError): boolean {
  if (error.code !== 'VERIFICATION_FAILED' || typeof error.details !== 'object' || error.details === null) {
    return false;
  }
  return (error.details as { reason?: unknown }).reason === 'FORK_LOG_INCOMPLETE';
}

type Busy = 'REMOTE' | 'LOCAL' | null;
type ActionError = { choice: 'REMOTE' | 'LOCAL'; message: string };

export function SyncConflictDialog({
  careerId,
  state,
  onToast,
}: {
  careerId: string;
  state: CareerSyncState;
  onToast: (toast: SyncToast) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const localQuery = useCareer(careerId);

  const conflict = state.kind === 'CONFLICT' ? state : null;
  const open = conflict !== null && !dismissed;

  async function handleTakeRemote() {
    setBusy('REMOTE');
    setActionError(null);
    try {
      const sync = await getSyncClient();
      await sync.resolveConflict(careerId, 'REMOTE');
      const after = sync.getState(careerId);
      if (after.kind === 'FAILED') {
        setActionError({ choice: 'REMOTE', message: after.error.message });
        return;
      }

      const engine = await getAppEngine();
      const load = await engine.client.loadCareer(careerId);
      if (!load.ok) {
        setActionError({ choice: 'REMOTE', message: load.error.message });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['careers'] });
      await queryClient.invalidateQueries({ queryKey: ['career', careerId] });
      platform.analytics.track('sync_conflict_resolved', { choice: 'REMOTE' });
      onToast({ variant: 'success', message: '다른 기기의 진행을 가져왔습니다' });
      const target = screenForCareer(load.snapshot.state);
      void navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });
    } catch (error) {
      // resolveConflict·store I/O가 예상 밖으로 throw하면(구조화된 { ok:false } 대신) 여기서
      // 잡아 화면에 보여준다 — 잡지 않으면 unhandled rejection으로 사용자는 아무 안내도 못 받는다.
      setActionError({ choice: 'REMOTE', message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' });
    } finally {
      setBusy(null);
    }
  }

  async function handleKeepLocal() {
    setBusy('LOCAL');
    setActionError(null);
    try {
      const engine = await getAppEngine();
      const result = await forkCareerByReplay(
        { engine: engine.client, store: engine.store, newId: () => crypto.randomUUID() },
        careerId,
      );
      if (!result.ok) {
        const message = isForkLogIncomplete(result.error)
          ? '이 기기에 명령 기록이 다 남아 있지 않아 복사할 수 없습니다'
          : result.error.message;
        setActionError({ choice: 'LOCAL', message });
        return;
      }

      const sync = await getSyncClient();
      await sync.resolveConflict(careerId, 'REMOTE');
      const after = sync.getState(careerId);
      if (after.kind === 'FAILED') {
        setActionError({ choice: 'LOCAL', message: after.error.message });
        return;
      }

      const forked = await engine.client.loadCareer(result.newCareerId);
      platform.analytics.track('sync_conflict_resolved', { choice: 'LOCAL' });

      if (!forked.ok) {
        // 여기서는 아직 내비게이션이 없으니(대화상자가 계속 열려 오류를 보여준다) 무효화가
        // 원래 화면의 가드와 경합할 일이 없다 — resolveConflict가 이미 원본을 REMOTE로
        // 덮었으니 캐시도 최신으로 맞춘다.
        await queryClient.invalidateQueries({ queryKey: ['careers'] });
        await queryClient.invalidateQueries({ queryKey: ['career', careerId] });
        setActionError({ choice: 'LOCAL', message: forked.error.message });
        return;
      }

      sync.notifyCommitted(result.newCareerId, forked.snapshot);
      onToast({
        variant: 'success',
        message: '이 기기의 진행을 새 커리어로 복사했습니다. 원래 커리어는 다른 기기의 진행을 따릅니다',
      });
      const target = screenForCareer(forked.snapshot.state);
      // 원래 careerId 쿼리 무효화는 내비게이션이 끝난 뒤에 한다: 먼저 무효화하면 아직
      // 마운트돼 있는 이 화면(원래 careerId의 style)의 useCareerStepGuard가 REMOTE로 덮인
      // 원래 커리어(빈 draft)를 보고 자기 것대로 SCR-002로 replace해 버려, 방금 건 이
      // navigate(포크로)를 덮어써 버린다(실제로 겪은 경합).
      await navigate({ to: SCREEN_ROUTES[target.screenId], params: target.params });

      await queryClient.invalidateQueries({ queryKey: ['careers'] });
      await queryClient.invalidateQueries({ queryKey: ['career', careerId] });
    } finally {
      setBusy(null);
    }
  }

  function handleDismiss() {
    if (busy !== null) return;
    setDismissed(true);
    setActionError(null);
    platform.analytics.track('sync_conflict_resolved', { choice: 'LATER' });
  }

  const serverParsed = conflict ? parseServerState(conflict.server.snapshot) : null;
  const localRevision = localQuery.data?.record.revision ?? conflict?.local.revision;
  const localState = localQuery.data?.state;

  const rows: CompareRow[] = [
    {
      id: 'revision',
      label: '진행 번호',
      cells: [{ value: localRevision !== undefined ? String(localRevision) : '—' }, { value: String(conflict?.server.revision ?? '—') }],
    },
    {
      id: 'age',
      label: '나이',
      cells: [
        { value: localState !== undefined ? String(localState.age) : '—' },
        { value: serverParsed !== null ? String(serverParsed.age) : '—' },
      ],
    },
    {
      id: 'stage',
      label: '단계',
      cells: [
        { value: localState !== undefined ? CAREER_STAGE_LABELS[localState.stage] : '—' },
        { value: serverParsed !== null ? CAREER_STAGE_LABELS[serverParsed.stage] : '—' },
      ],
    },
    {
      id: 'timeline',
      label: '마지막 기록',
      cells: [{ value: lastTimelineLabel(localState?.timeline) }, { value: lastTimelineLabel(serverParsed?.timeline) }],
    },
  ];

  const cards: CompareCardItem[] = [
    {
      id: 'local',
      title: '이 기기',
      renderAction: (layout) => (
        <div className="flex flex-col gap-os-2">
          <Button variant="secondary" onClick={() => void handleKeepLocal()} disabled={busy !== null}>
            이 기기 진행 유지
          </Button>
          {actionError?.choice === 'LOCAL' ? (
            <div className="flex flex-col gap-os-2">
              <p id={`sync-conflict-local-error-${layout}`} className="font-os text-os-danger" style={CAPTION_STYLE}>
                {actionError.message}
              </p>
              <Button variant="ghost" onClick={() => void handleKeepLocal()} disabled={busy !== null}>
                다시 시도
              </Button>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'server',
      title: '다른 기기',
      renderAction: (layout) => (
        <div className="flex flex-col gap-os-2">
          <Button variant="primary" onClick={() => void handleTakeRemote()} disabled={busy !== null}>
            다른 기기 진행 가져오기
          </Button>
          {actionError?.choice === 'REMOTE' ? (
            <p id={`sync-conflict-remote-error-${layout}`} className="font-os text-os-danger" style={CAPTION_STYLE}>
              {actionError.message}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
      }}
    >
      <DialogContent
        title="다른 기기에서 이 커리어가 더 진행됐습니다"
        closeLabel="닫기"
        onEscapeKeyDown={(event) => {
          if (busy !== null) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy !== null) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy !== null) event.preventDefault();
        }}
      >
        <div className="flex flex-col gap-os-4">
          <CompareCards cards={cards} rows={rows} />
          <Button variant="ghost" onClick={handleDismiss} disabled={busy !== null}>
            나중에
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 06 "저장 상태 표시": 커리어의 동기화 상태를 어디서나 같은 문구·색으로 보여준다. 문구는 아래
// 표를 그대로 쓴다(브랜드 어휘 금지) — 색은 참고용이고 문구가 항상 함께 있어야 한다.
import { useEffect, useRef, useState } from 'react';
import type { CareerSyncState } from '@offside/engine-client';
import { formatRelativeTime } from './format.js';

type Tone = 'success' | 'neutral' | 'warning' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  success: 'text-os-success',
  neutral: 'text-os-neutral',
  warning: 'text-os-warning',
  danger: 'text-os-danger',
};

const TONE_ICON: Record<Tone, string> = {
  success: '✓',
  neutral: '●',
  warning: '▲',
  danger: '!',
};

export type SyncBadgeCopy = {
  tone: Tone;
  text: string;
  lastSyncedAtIso?: string;
};

/**
 * 06 문구 표(그대로): IDLE "저장됨"(+ 상대 시각, lastSyncedAt null이면 "아직 저장 안 됨"),
 * SCHEDULED·SYNCING "저장 중", RETRYING "저장 다시 시도 중", OFFLINE "오프라인 · 이 기기에만
 * 저장됨", LOCAL_ONLY "로컬 전용", CONFLICT "다른 기기와 어긋남", FAILED "서버 저장 실패".
 */
export function describeSyncState(state: CareerSyncState): SyncBadgeCopy {
  switch (state.kind) {
    case 'IDLE':
      return state.lastSyncedAt === null
        ? { tone: 'success', text: '아직 저장 안 됨' }
        : { tone: 'success', text: '저장됨', lastSyncedAtIso: state.lastSyncedAt };
    case 'SCHEDULED':
    case 'SYNCING':
      return { tone: 'neutral', text: '저장 중' };
    case 'RETRYING':
      return { tone: 'warning', text: '저장 다시 시도 중' };
    case 'OFFLINE':
      return { tone: 'warning', text: '오프라인 · 이 기기에만 저장됨' };
    case 'LOCAL_ONLY':
      return { tone: 'warning', text: '로컬 전용' };
    case 'CONFLICT':
      return { tone: 'danger', text: '다른 기기와 어긋남' };
    case 'FAILED':
      return { tone: 'danger', text: '서버 저장 실패' };
  }
}

const CAPTION_STYLE = {
  fontSize: 'var(--os-fs-caption)',
  lineHeight: 'var(--os-lh-caption)',
} as const;

export function SyncBadge({ state }: { state: CareerSyncState }) {
  const copy = describeSyncState(state);
  const previousKindRef = useRef(state.kind);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const previousKind = previousKindRef.current;
    previousKindRef.current = state.kind;
    if (previousKind !== state.kind && (state.kind === 'CONFLICT' || state.kind === 'FAILED')) {
      setAnnouncement(describeSyncState(state).text);
    }
  }, [state]);

  return (
    <span className="os-sync-badge" data-sync-state={state.kind} style={CAPTION_STYLE}>
      <span aria-hidden="true" className={TONE_CLASS[copy.tone]}>
        {TONE_ICON[copy.tone]}
      </span>
      <span className="text-os-text">{copy.text}</span>
      {copy.lastSyncedAtIso !== undefined ? (
        <time dateTime={copy.lastSyncedAtIso} className="text-os-text-2">
          {formatRelativeTime(copy.lastSyncedAtIso)}
        </time>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}

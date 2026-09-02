// SCR-030 설정·데이터(로컬 부분만). 데이터 섹션(복구 코드·프로필 복구·Google 연결·동기화·내보내기·
// 삭제)은 행만 두고 "준비 중" 비활성으로 둔다(T-1-012·013이 채운다). 채널 문구 분기는 platform이
// 주는 값으로만 한다 — 이 화면은 채널별 문구가 필요 없는 로컬 부분만 다룬다.
import { useEffect, useState } from 'react';
import { Button, buttonClassName, buttonStyle, Card, RadioGroup, RadioGroupItem } from '@offside/ui';
import { ENGINE_CLIENT_VERSION } from '@offside/engine-client';
import type { ErrorCode } from '@offside/contracts';
import type { SimulationMode } from '@offside/domain';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ensureProfile } from '../api/profile.js';
import { getAppEngine } from '../engine/engine.js';
import { retryPendingDeletes } from '../engine/pending-delete.js';
import { getSyncClient, requeueAllUnsynced } from '../engine/sync.js';
import { useSyncSummary } from '../engine/use-sync.js';
import { ACTIVE_CONTENT_PACK_VERSION, ACTIVE_RULESET_VERSION } from '../engine/versions.js';
import { platform } from '../platform/index.js';
import { queryClient } from '../shared/query-client.js';
import { SyncBadge } from '../shared/SyncBadge.js';
import {
  useUiStore,
  type ReducedMotionPreference,
  type TextScale,
  type ThemePreference,
} from '../shared/ui-store.js';

export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
});

const H1_STYLE = { fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' } as const;
const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

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

const DATA_ROWS = [
  { id: 'recovery-code', label: '복구 코드' },
  { id: 'profile-recover', label: '프로필 복구' },
  { id: 'google', label: 'Google 연결' },
  { id: 'export', label: '내보내기' },
  { id: 'delete-profile', label: '프로필 삭제' },
  { id: 'delete-device-data', label: '이 기기 데이터 삭제' },
] as const;

/** FAILED 코드별 안내. 목록에 없으면 "서버가 저장을 거부했습니다(코드)". */
const FAILED_CODE_MESSAGE: Partial<Record<ErrorCode, string>> = {
  VERSION_MISMATCH: '앱을 새로고침해 최신 버전을 받으세요',
  CAREER_ARCHIVED: '보관된 커리어는 더 저장하지 않습니다',
};

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
            이 브라우저에서는 서버 저장을 할 수 없습니다. 쿠키가 차단됐거나 세션이 없습니다. 복구 코드
            없이 브라우저 데이터를 지우면 되돌릴 수 없습니다.
          </p>
          <Button variant="secondary" onClick={() => void handleReconnect()} disabled={reconnecting}>
            다시 연결
          </Button>
        </div>
      ) : null}

      {summary.kind === 'FAILED' ? (
        <p className="font-os text-os-danger" style={CAPTION_STYLE}>
          {FAILED_CODE_MESSAGE[summary.error.code] ?? `서버가 저장을 거부했습니다(${summary.error.code})`}
        </p>
      ) : null}
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

  return (
    <div className="flex flex-col gap-os-6">
      <h1 className="font-os font-bold text-os-text" style={H1_STYLE}>
        설정
      </h1>

      <section className="flex flex-col gap-os-3">
        <h2 id="settings-theme" className="font-os font-semibold text-os-text" style={H2_STYLE}>
          테마
        </h2>
        <RadioGroup aria-labelledby="settings-theme" value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
          {THEME_OPTIONS.map((option) => (
            <RadioGroupItem key={option.value} value={option.value}>
              {option.label}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </section>

      <section className="flex flex-col gap-os-3">
        <h2 id="settings-reduced-motion" className="font-os font-semibold text-os-text" style={H2_STYLE}>
          모션 감소
        </h2>
        <RadioGroup
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
        <h2 id="settings-text-scale" className="font-os font-semibold text-os-text" style={H2_STYLE}>
          텍스트 크기
        </h2>
        <RadioGroup
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

      <section className="flex flex-col gap-os-3">
        <h2 id="settings-simulation-mode" className="font-os font-semibold text-os-text" style={H2_STYLE}>
          시뮬레이션 기본 모드
        </h2>
        <RadioGroup
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

      <section className="flex flex-col gap-os-3">
        <h2 id="settings-version" className="font-os font-semibold text-os-text" style={H2_STYLE}>
          버전
        </h2>
        <dl className="os-num flex flex-col gap-os-1 font-os text-os-text-2" style={CAPTION_STYLE} aria-labelledby="settings-version">
          <div className="flex justify-between gap-os-2">
            <dt>룰셋</dt>
            <dd>{ACTIVE_RULESET_VERSION}</dd>
          </div>
          <div className="flex justify-between gap-os-2">
            <dt>콘텐츠 팩</dt>
            <dd>{ACTIVE_CONTENT_PACK_VERSION}</dd>
          </div>
          <div className="flex justify-between gap-os-2">
            <dt>엔진 클라이언트</dt>
            <dd>{ENGINE_CLIENT_VERSION}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-os-3">
        <h2 id="settings-data" className="font-os font-semibold text-os-text" style={H2_STYLE}>
          데이터
        </h2>
        <ul className="flex flex-col gap-os-2" aria-labelledby="settings-data">
          <li>
            <SyncStatusRow />
          </li>
          {DATA_ROWS.map((row) => (
            <li key={row.id}>
              <Card className="flex items-center justify-between gap-os-3">
                <span className="font-os text-os-text">{row.label}</span>
                <Button variant="secondary" disabled>
                  준비 중
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/" className={buttonClassName('secondary')} style={buttonStyle}>
        허브로
      </Link>
    </div>
  );
}

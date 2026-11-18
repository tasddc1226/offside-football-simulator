<script lang="ts">
  import type { BackupControl } from '@offside/contracts';
  import { clearApiCache, post } from '../api.ts';
  import { auth, loader } from '../load.svelte.ts';
  import Load from './Load.svelte';

  const BACKUP_CONTROL_PATH = '/v1/admin/schedules/backup';
  let { tick }: { tick: number } = $props();
  let refresh = $state(0);
  let busy = $state(false);
  let message = $state('');
  const control = loader<BackupControl>(
    () => BACKUP_CONTROL_PATH,
    () => tick + refresh,
  );
  const fmt = (at: number) =>
    new Date(at).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  const paused = (value: BackupControl) => value.pausedUntil > value.observedAt;
  // Refresh once at the deadline while the tab is open.
  $effect(() => {
    const r = control.r;
    if (!r?.ok || !paused(r.data)) return;
    const timer = setTimeout(
      () => {
        clearApiCache();
        refresh++;
      },
      Math.max(0, r.data.pausedUntil - r.data.observedAt) + 1000,
    );
    return () => clearTimeout(timer);
  });
  async function change(value: BackupControl) {
    if (busy) return;
    busy = true;
    message = '';
    const result = await post<BackupControl>(BACKUP_CONTROL_PATH, {
      revision: value.revision,
      action: paused(value) ? 'resume' : 'pause',
    });
    if (result.ok) control.r = result;
    else {
      message = result.status === 409 ? '다른 요청으로 백업 상태가 바뀌었어요. 최신 상태를 확인해 주세요.' : result.message;
      if (result.status === 401 || result.status === 403) auth.denied = result.status;
      refresh++;
    }
    busy = false;
  }
</script>

<section class="panel">
  <header><h2>백업 제어</h2></header>
  <Load r={control.r} height={84}>
    {#snippet children(v)}
      <strong
        >{paused(v)
          ? v.draining
            ? '정지 요청됨 · 현재 조각 마무리 중'
            : '일시정지됨'
          : '백업 실행 허용'}</strong
      >
      <p>
        {paused(v)
          ? fmt(v.pausedUntil) + ' 자동 재개 예정 (KST)'
          : '정지하면 다음 백업 조각부터 30분 동안 대기해요.'}
      </p>
      <button disabled={busy} onclick={() => change(v)}
        >{busy ? '처리 중…' : paused(v) ? '지금 재개' : '30분 일시정지'}</button
      >
      {#if !paused(v) && v.history.length}<p>남은 백업은 다음 예약 시각에 이어서 처리해요.</p>{/if}
      <details>
        <summary>최근 변경 이력 ({v.history.length}건)</summary>
        <ul>
          {#each v.history as entry (entry)}<li>
              {fmt(entry.at)} · {entry.action === 'pause' ? '30분 일시정지' : '재개'} · 관리자 {entry.actor}
            </li>{:else}<li>변경 기록 없음</li>{/each}
        </ul>
      </details>
    {/snippet}
  </Load>
  {#if message}<p role="alert">{message}</p>{/if}
</section>

<style>
  p {
    color: var(--text-2);
  }
  button,
  summary {
    min-height: 44px;
  }
  button {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    padding: 0 14px;
    font: inherit;
    cursor: pointer;
  }
  summary {
    padding-top: 12px;
    cursor: pointer;
  }
  ul {
    padding-left: 18px;
    overflow-wrap: anywhere;
  }
</style>

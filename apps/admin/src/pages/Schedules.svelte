<script lang="ts">
  import type { AdminSchedules } from '@offside/contracts';
  import { loader } from '../load.svelte.ts';
  import BackupControl from '../ui/BackupControl.svelte';
  import Load from '../ui/Load.svelte';

  let { tick }: { days: number; tick: number } = $props();
  const report = loader<AdminSchedules>(
    () => '/v1/admin/schedules',
    () => tick,
  );
  const time = (at: number) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(at);
  const statuses: Record<string, string> = {
    complete: '완료',
    pending: '대기',
    running: '진행 중',
    retry: '재시도 대기',
    success: '성공',
    failure: '실패',
    cancelled: '취소',
    skipped: '건너뜀',
    queued: '대기',
    in_progress: '진행 중',
  };
  const jobs: Record<string, string> = {
    'offside-api:*/5 * * * *': '5분마다 · 시즌·컵·리그 진행, 푸시, 백업·보관 작업',
    'offside-api:0 19 * * *': '매일 04:00 · 데이터 정리 및 인프라 점검',
    'offside-agents:*/5 * * * *': '5분마다 · 서버 상태 및 게이트웨이 점검',
    'offside-agents:7 * * * *': '매시 07분 · 고객 문의와 스토어 리뷰',
    'offside-agents:47 */3 * * *': '3시간마다 47분 · 이용자 반응 확인',
    'offside-agents:50 23 * * *': '매일 08:50 · 아침 운영 보고와 지표 수집',
    'offside-agents:0 1,9 * * *': '매일 10:00·18:00 · 승인 대기 목록',
  };
</script>

<div class="page">
  <BackupControl {tick} />
  <Load r={report.r} height={400}>
    {#snippet children(r)}
      <section class="panel">
        <header>
          <h2>게임 서버 실행 기록</h2>
          <span class="hint">{time(r.observedAt)} 조회</span>
        </header>
        <dl>
          <div>
            <dt>일일 정리</dt>
            <dd class:attention={r.daily?.status === 'retry'}>
              {r.daily ? (statuses[r.daily.status] ?? r.daily.status) : '기록 없음'}
              {r.daily ? '· ' + time(r.daily.updatedAt) : ''}
            </dd>
          </div>
          <div>
            <dt>D1 → R2 백업</dt>
            <dd>
              {r.backupRunningSince ? '현재 회차 시작 ' + time(r.backupRunningSince) : ''}
              {r.backup
                ? '최근 완료 ' + time(r.backup.finishedAt) + ' · ' + r.backup.steps + '단계'
                : '완료 기록 없음'}
            </dd>
          </div>
          <div>
            <dt>인프라 점검</dt>
            <dd class:attention={Boolean(r.infra?.issues.length)}>
              {r.infra
                ? time(r.infra.at) +
                  (r.infra.issues.length
                    ? ' · 주의 ' + r.infra.issues.length + '건'
                    : ' · 이상 없음')
                : '기록 없음'}
              {#each r.infra?.issues ?? [] as issue (issue)}<small>{issue}</small>{/each}
            </dd>
          </div>
        </dl>
      </section>
      <section class="panel">
        <header><h2>Worker 등록 일정</h2></header>
        {#if !r.sources?.workers}<p>등록 현황 확인 불가</p>{:else}
          {#each r.sources.workers as w (w.name)}
            <h3>{w.name}</h3>
            {#if w.available}<ul>
                {#each w.crons as cron (cron)}<li>
                    {jobs[w.name + ':' + cron] ?? cron + ' (UTC)'}
                  </li>{:else}<li>등록 일정 없음</li>{/each}
              </ul>
              {#if w.next[0]}<p>다음 예정 {w.next[0]}</p>{/if}
            {:else}<p>등록 현황 확인 불가</p>{/if}
          {/each}
        {/if}
      </section>
      <section class="panel">
        <header>
          <h2>예약 작업 실행 로그</h2>
          <span class="hint">최근 24시간 · Worker별 최대 20건</span>
        </header>
        {#each r.sources?.activity ?? [] as a (a.worker)}
          <details>
            <summary
              ><strong>{a.worker}</strong><span
                >{a.events?.[0]
                  ? '최근 관측 ' + time(a.events[0].at)
                  : a.events
                    ? '관측 기록 없음'
                    : '로그 확인 불가'}</span
              ></summary
            >
            <ul>
              {#each a.events ?? [] as event (event)}<li class:attention={event.result === 'error'}>
                  {time(event.at)} · {event.job ?? event.cron} · {event.result === 'error'
                    ? '오류'
                    : event.result === 'ok' || event.result === 'observed'
                      ? '실행 관측'
                      : event.result}
                </li>{/each}
            </ul>
          </details>
        {:else}<p>로그 확인 불가</p>{/each}
      </section>
      <section class="panel">
        <header><h2>최근 24시간 Worker 오류 로그</h2></header>
        {#each r.sources?.errors ?? [] as e (e.worker)}
          <h3 class:attention={e.total !== null && e.total > 0}>{e.worker} · {e.total === null ? '확인 불가' : e.total + '건'}</h3>
          {#if e.jobs === null}<p>작업별 집계 확인 불가</p>{:else}<ul>
              {#each e.jobs as j (j.job)}<li>{j.job} · {j.count}건</li>{/each}
            </ul>{/if}
        {:else}<p>로그 조회 불가</p>{/each}
        <p>
          전체 오류에는 HTTP 요청과 큐 처리도 포함됩니다. 작업명이 기록된 오류만 세부 목록에
          표시합니다.
        </p>
      </section>
      <section class="panel">
        <header>
          <h2>GitHub 예약 작업</h2>
          <span class="hint">최근 예약 실행 100건 중 작업별 최대 5회</span>
        </header>
        {#if !r.sources?.actions}<p>예약 및 실행 기록 확인 불가</p>{:else}
          {#each r.sources.actions as a (a.name)}
            <details>
              <summary
                ><strong>{a.name}</strong><span
                  >{a.recent[0]
                    ? (statuses[a.recent[0].result] ?? a.recent[0].result) + ' · ' + a.recent[0].at
                    : '최근 100건에 실행 기록 없음'}</span
                ></summary
              >
              <p>등록 일정 (UTC) · {a.crons.join(' / ')}</p>
              {#if a.next[0]}<p>다음 예정 {a.next[0]}</p>{/if}
              <ul>
                {#each a.recent as run (run)}<li>
                    {run.at} · {statuses[run.result] ?? run.result}
                  </li>{/each}
              </ul>
            </details>
          {:else}<p>등록 일정 없음</p>{/each}
        {/if}
      </section>
    {/snippet}
  </Load>
</div>

<style>
  .attention { color: var(--bad); }
  dl,
  ul {
    margin: 0;
  }
  dl > div,
  details {
    border-top: 1px solid var(--border);
    padding: 0.6rem 0;
  }
  dl > div {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.3rem 1rem;
  }
  dd {
    margin: 0;
  }
  dt,
  h3 {
    font-weight: 600;
  }
  small,
  summary span {
    display: block;
  }
  h3 {
    font-size: 0.95rem;
    margin: 1rem 0 0.4rem;
  }
  ul {
    padding-left: 1.3rem;
    line-height: 1.65;
  }
  summary {
    cursor: pointer;
    min-height: 44px;
  }
  p,
  summary span {
    font-size: 0.88rem;
    color: var(--text-2);
  }
  .panel {
    overflow-wrap: anywhere;
  }
  @media (min-width: 1080px) {
    .page {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
    .panel:first-child {
      grid-column: 1/-1;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }
    dl > div {
      display: block;
    }
  }
</style>

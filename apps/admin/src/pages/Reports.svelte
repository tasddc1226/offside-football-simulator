<script lang="ts">
  // T-11-577 신고 · 이상: 열린 라운지 채팅 신고 · 이름 신고 · 비정상 커리어(검토 대상). 처리 버튼은 기존 운영 도구에 있다.
  import type { AdminChatReportList, AdminNameReportList, AnomalyReport } from '@offside/contracts';
  import { GAME_URL } from '../api.ts';
  import { fmt, kstTime } from '../kpi.ts';
  import { loader } from '../load.svelte.ts';
  import Load from '../ui/Load.svelte';
  import Stat from '../ui/Stat.svelte';

  let { tick }: { days: number; tick: number } = $props();
  const chat = loader<AdminChatReportList>(() => '/v1/admin/chat/reports', () => tick);
  const names = loader<AdminNameReportList>(() => '/v1/admin/name-reports', () => tick);
  const anomalies = loader<AnomalyReport>(() => '/v1/admin/anomalies', () => tick);

  const REASON: Record<string, string> = { spam: '도배', abuse: '욕설', sexual: '음란', other: '기타' };
  const KIND: Record<string, string> = { career: '선수 이름', team: '구단 · 감독 이름', owner: '구단주 닉네임' };
  const ANOMALY: Record<string, string> = {
    ovrFar: 'OVR 상한 크게 넘음',
    ovrHigh: 'OVR 상한 조금 넘음',
    jump: '한 시즌 급상승',
    legend: '레전드 점수 이상',
  };
  const count = <T,>(r: { ok: true; data: T } | { ok: false } | null, n: (d: T) => number) =>
    r?.ok ? n(r.data) : null;
</script>

<div class="page">
  <div class="stats">
    <Stat label="열린 채팅 신고" value={count(chat.r, (d) => d.items.length)} />
    <Stat label="열린 이름 신고" value={count(names.r, (d) => d.items.length)} />
    <Stat label="검토할 커리어" value={count(anomalies.r, (d) => d.review.length)} sub="자동 숨김은 매일 cron이 처리" />
  </div>
  <p class="note">
    처리(가리기 · 정지 · 닫기)는 <a href={`${GAME_URL}/settings`} target="_blank" rel="noreferrer">기존 운영 도구</a>에서
    해요.
  </p>

  <div class="cols">
    <Load r={chat.r} height={220}>
      {#snippet children(d)}
        <section class="panel">
          <header><h2>라운지 채팅 신고</h2><span class="hint">열린 것만</span></header>
          {#if d.items.length}
            <ul class="list">
              {#each d.items as x (x.messageId)}
                <li>
                  <p class="body">{x.body}</p>
                  <p class="meta">
                    {x.nickname} · 신고 {fmt(x.reports)} · {x.reasons.map((r) => REASON[r] ?? r).join(', ')} ·
                    {kstTime(x.lastReportedAt)}
                  </p>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="note">열린 신고가 없어요.</p>
          {/if}
        </section>
      {/snippet}
    </Load>
    <Load r={names.r} height={220}>
      {#snippet children(d)}
        <section class="panel">
          <header><h2>이름 신고</h2><span class="hint">열린 것만</span></header>
          {#if d.items.length}
            <div class="tbl-wrap">
              <table class="tbl">
                <thead><tr><th>종류</th><th>이름</th><th class="num">신고</th><th>마지막 (KST)</th></tr></thead>
                <tbody>
                  {#each d.items as x (`${x.kind}-${x.targetId}`)}
                    <tr>
                      <td>{KIND[x.kind] ?? x.kind}</td>
                      <td>{x.name ?? '—'}</td>
                      <td class="num">{fmt(x.reports)}</td>
                      <td>{kstTime(x.lastReportedAt)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="note">열린 신고가 없어요.</p>
          {/if}
        </section>
      {/snippet}
    </Load>
  </div>

  <Load r={anomalies.r} height={220}>
    {#snippet children(d)}
      <section class="panel">
        <header>
          <h2>비정상 커리어</h2>
          <span class="hint">검토 {fmt(d.review.length)} · 숨김 {fmt(d.hidden.length)} · {kstTime(d.generatedAt)} 기준</span>
        </header>
        {#if d.review.length}
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>커리어</th><th>상태</th><th class="num">최고 OVR</th><th class="num">레전드 점수</th><th>이유</th></tr></thead>
              <tbody>
                {#each d.review as x (x.careerId)}
                  <tr>
                    <td><code>{x.careerId.slice(0, 12)}</code></td>
                    <td>{x.status === 'active' ? '진행 중' : '은퇴'}</td>
                    <td class="num">{fmt(x.peak)}</td>
                    <td class="num">{fmt(x.legendScore)}</td>
                    <td>{x.reasons.map((r) => ANOMALY[r] ?? r).join(', ')}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="note">검토할 커리어가 없어요.</p>
        {/if}
      </section>
    {/snippet}
  </Load>
</div>

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .list li {
    padding: 8px 0;
    border-bottom: 1px solid var(--grid);
  }
  .body {
    margin: 0 0 4px;
    font-size: 13px;
    word-break: break-all;
  }
  .meta {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .note a {
    color: var(--accent);
  }
  code {
    font-size: 12px;
  }
</style>

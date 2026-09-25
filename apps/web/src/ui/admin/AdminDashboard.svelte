<script lang="ts">
  // T-10-016 운영 대시보드: 가입·활동·커리어·댓글 수와 최근 14일(KST) 추이. 집계는 서버에서 1분 캐시된다.
  import { onMount } from 'svelte';
  import * as api from '../../api/admin.js';
  import type { AdminStats } from '../../api/admin.js';

  const AUDIT: Record<string, string> = {
    PROFILE_DELETED: '프로필 삭제',
    RECOVERY_CODE_ISSUED: '복구 코드 발급',
    GOOGLE_LINKED: '구글 연결',
    GOOGLE_UNLINKED: '구글 연결 해제',
    CAREERS_MERGED: '커리어 합치기',
    BALANCE_ACTIVATED: '밸런스 적용',
    COMMENTS_PURGED: '작성자 댓글 일괄 삭제',
  };
  const SERIES = [
    { key: 'profiles', label: '신규 가입' },
    { key: 'careers', label: '새 커리어' },
    { key: 'retired', label: '은퇴' },
  ] as const;

  let stats = $state<AdminStats | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');

  onMount(() => void load());

  async function load(fresh = false) {
    const r = await api.fetchAdminStats(fresh);
    if (!r.ok) {
      status = stats ? 'ready' : 'error';
      return;
    }
    stats = r.data;
    status = 'ready';
  }

  const kst = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' });
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const maxOf = (s: AdminStats, key: (typeof SERIES)[number]['key']) => Math.max(1, ...s.daily.map((d) => d[key]));
</script>

<div class="stack" style="gap:14px" data-admin="dashboard">
  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">대시보드</h2>
    <button class="icon-btn" data-act="refresh-stats" onclick={() => load(true)}>새로고침</button>
  </div>
  {#if status === 'loading'}
    <p class="muted" aria-live="polite">불러오는 중…</p>
  {:else if status === 'error' || !stats}
    <div class="stack" style="gap:8px">
      <p class="muted" style="margin:0">대시보드를 불러오지 못했어요.</p>
      <button class="icon-btn" style="align-self:flex-start" onclick={() => load(true)}>다시 시도</button>
    </div>
  {:else}
    {@const s = stats}
    <p class="muted" style="margin:0;font-size:12px">{kst(s.generatedAt)} 기준(KST) · 1분마다 갱신</p>
    <div class="stat-grid">
      <div class="stat" data-stat="users"><span>전체 유저</span><b>{s.profiles.total.toLocaleString()}</b><small>구글 연결 {s.profiles.linked.toLocaleString()} ({pct(s.profiles.linked, s.profiles.total)})</small></div>
      <div class="stat" data-stat="active"><span>활동 유저 (24시간)</span><b>{s.profiles.active24h.toLocaleString()}</b><small>7일 {s.profiles.active7d.toLocaleString()}</small></div>
      <div class="stat" data-stat="signups"><span>신규 가입 (24시간)</span><b>{s.profiles.new24h.toLocaleString()}</b><small>7일 {s.profiles.new7d.toLocaleString()}</small></div>
      <div class="stat" data-stat="careers"><span>업로드된 커리어</span><b>{s.careers.total.toLocaleString()}</b><small>진행 {s.careers.active.toLocaleString()} · 은퇴 {s.careers.retired.toLocaleString()}</small></div>
      <div class="stat" data-stat="careers7d"><span>최근 7일 커리어</span><b>{s.careers.new7d.toLocaleString()}</b><small>은퇴 {s.careers.retired7d.toLocaleString()}</small></div>
      <div class="stat" data-stat="board"><span>댓글</span><b>{s.board.comments.toLocaleString()}</b><small>7일 {s.board.comments7d.toLocaleString()} · 글 {s.board.posts}</small></div>
    </div>
    <p class="muted" style="margin:0;font-size:12px" data-stat="balance">
      밸런스 {s.balance ? `v${s.balance.version} 적용 중${s.balance.activatedAt ? ` (${kst(s.balance.activatedAt)})` : ''}` : '기본값'}
    </p>
    <p class="muted" style="margin:0;font-size:12px">활동 유저는 앱을 열어 서버에 프로필을 확인한 수예요. 게임은 기기에서 돌아가 실제 플레이 수와 다를 수 있어요.</p>

    {#each SERIES as ser (ser.key)}
      {@const max = maxOf(s, ser.key)}
      <figure class="daily" data-series={ser.key}>
        <figcaption>{ser.label} · 최근 14일 <span class="muted">(합계 {s.daily.reduce((a, d) => a + d[ser.key], 0).toLocaleString()})</span></figcaption>
        <div class="bars" role="list">
          {#each s.daily as d (d.day)}
            <div class="bar" role="listitem" aria-label="{d.day} {d[ser.key]}" title="{d.day} · {d[ser.key]}">
              <i style="height:{Math.round((d[ser.key] / max) * 100)}%"></i>
              <small>{d.day.slice(8)}</small>
            </div>
          {/each}
        </div>
      </figure>
    {/each}

    <div class="stack" style="gap:6px">
      <h3 style="margin:0">최근 운영 기록</h3>
      <ul class="audit">
        {#each s.audit as a, i (i)}
          <li><span>{AUDIT[a.kind] ?? a.kind}</span><span class="muted">{kst(a.createdAt)}</span></li>
        {:else}
          <li class="muted">기록이 없어요.</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  @media (min-width: 560px) { .stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .stat { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .stat span { font-size: 12px; color: var(--muted); }
  .stat b { font-size: 22px; font-variant-numeric: tabular-nums; }
  .stat small { font-size: 12px; color: var(--muted); }
  .daily { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .daily figcaption { font-size: 13px; font-weight: 600; }
  .bars { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 3px; height: 90px; align-items: end; }
  .bar { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; }
  .bar i { width: 100%; min-height: 2px; background: var(--pitch); border-radius: 3px 3px 0 0; }
  .bar small { font-size: 10px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .audit { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .audit li { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
</style>

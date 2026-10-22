<script lang="ts">
  // T-11-145 오프사이드 컵 열기: 접수 시작일만 고르면 표준 일정(접수 4일 → 추첨 12시 → 정원 128이면 9일간, 64 이하면 8일간 매일 21시 경기)으로
  // 다음 회차를 연다. 시즌·회차·id는 서버가 정하고, 다른 대회와 기간이 겹치면 막는다. 접수 전 대회만 지울 수 있다.
  // T-11-246 접수 시작 시각을 고르면 앞 대회 결승 직후(결승 시각 뒤)에 바로 접수를 열 수 있다. 정원 128이면 64강부터.
  // T-11-410 OVR 구간별로 열 수 있다(주니어 · 시니어 · 마스터). 아랫 구간 상한은 접수 전까지 고치고, 비워 두면 접수가 열릴 때
  // 그 시즌 팀 분포로 자동으로 채운다.
  import { onMount } from 'svelte';
  import AdminCupPredictions from './AdminCupPredictions.svelte';
  import { CUP_PLAN_DEFAULTS as D, planCup } from '@offside/contracts/cup';
  import * as api from '@offside/app-core/api/admin';
  import type { AdminCup } from '@offside/app-core/api/admin';
  import { kstDateTime as kst } from '@offside/app-core/boardText';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  const STATUS = { scheduled: '접수 전', entry: '접수 중', running: '진행 중', done: '끝남' } as const;

  let items = $state<AdminCup[]>([]);
  let status = $state<LoadStatus>('loading');
  let busy = $state(false);
  let opensOn = $state('');
  let opensTime = $state('');
  let entryDays = $state<number>(D.entryDays);
  let matchHour = $state<number>(D.matchHour);
  let capacity = $state<number>(D.capacity);
  let minFilled = $state<number>(D.minFilled);
  let divisions = $state(true);
  let suggest = $state<{ season: number; teams: number; caps: number[] } | null>(null);
  let capDraft = $state<Record<string, number>>({});
  const DIVISION = { junior: '주니어', senior: '시니어', master: '마스터' } as const;

  const input = $derived({ opensOn, ...(opensTime ? { opensTime } : {}), entryDays, matchHour, capacity, minFilled, divisions });
  const preview = $derived(
    /^\d{4}-\d{2}-\d{2}$/.test(opensOn) ? planCup({ ...input, id: '', season: 0, edition: 0 }) : null,
  );

  onMount(() => void load());

  async function load() {
    status = 'loading';
    const r = await api.fetchAdminCups();
    if (!r.ok) return (status = 'error');
    items = r.data.items;
    status = 'ready';
    if (items.some((it) => it.status === 'scheduled' && it.cup.division && it.cup.division !== 'master')) {
      const s = await api.fetchCupCapsSuggest();
      if (s.ok) suggest = s.data;
    }
  }
  async function saveCap(it: AdminCup) {
    const v = capDraft[it.cup.id];
    if (!v) return;
    busy = true;
    const r = await api.setCupCap(it.cup.id, v);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(`${DIVISION[it.cup.division!]} 상한을 ${v}로 정했어요`);
    await load();
  }
  async function create() {
    if (!preview || !confirm(`${kst(preview.opensAt)}에 접수를 여는 대회를 만들까요?`)) return;
    busy = true;
    const r = await api.createCup(input);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(`제${r.data.cup.edition}회 대회를 열었어요`);
    opensOn = '';
    opensTime = '';
    await load();
  }
  async function remove(it: AdminCup) {
    if (!confirm(`제${it.cup.edition}회 대회를 지울까요?`)) return;
    busy = true;
    const r = await api.deleteCup(it.cup.id);
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast('대회를 지웠어요');
    await load();
  }
</script>

<div class="stack" style="gap:12px" data-admin="cups">
  {#if status === 'ready'}<AdminCupPredictions cups={items} />{/if}
  <h2 style="margin:0">새 대회 열기</h2>
  <p class="muted fs-sm" style="margin:0" data-cup-autopilot>결승이 끝나면 서버가 다음 회차를 자동으로 만들어요(결승 10분 뒤 접수, 사흘째 자정 마감, 정원은 앞 대회와 같음). 접수가 열리면 참가할 수 있는 구단주에게 알림이 가고, 추첨·경기가 30분 넘게 밀리면 운영 슬랙에 경보가 와요. 자동 생성을 멈추려면 app_meta의 cup:autopilot을 off로 둬요. 일정을 바꾸려면 아래에서 직접 열어요.</p>
  <div class="cup-form">
    <label>접수 시작일(KST)<input type="date" bind:value={opensOn} data-cup-field="opensOn" /></label>
    <label>접수 시작 시각(KST, 비우면 0시)<input type="time" bind:value={opensTime} data-cup-field="opensTime" /></label>
    <label>접수 기간(일)<input type="number" min="1" max="14" bind:value={entryDays} /></label>
    <label>경기 시각(시)<input type="number" min="14" max="23" bind:value={matchHour} /></label>
    <label>정원<input type="number" min="4" max="128" bind:value={capacity} /></label>
    <label>자격(선발 실제 선수)<input type="number" min="1" max="11" bind:value={minFilled} /></label>
    <label class="row" style="gap:6px;flex-direction:row;align-items:center"><input type="checkbox" bind:checked={divisions} data-cup-field="divisions" />OVR 구간별(주니어 · 시니어 · 마스터)</label>
  </div>
  {#if preview}
    <dl class="cup-plan" data-cup-preview>
      <div><dt>접수</dt><dd>{kst(preview.opensAt)} ~ {kst(preview.closesAt)}</dd></div>
      <div><dt>추첨</dt><dd>{kst(preview.drawAt)}</dd></div>
      <div><dt>경기</dt><dd>{kst(preview.rounds[0]!)} ~ {kst(preview.rounds.at(-1)!)} (매일 1경기)</dd></div>
    </dl>
  {/if}
  <button class="btn" data-act="cup-create" disabled={busy || !preview} onclick={create}>대회 열기</button>

  <div class="row" style="justify-content:space-between">
    <h2 style="margin:0">대회 목록</h2>
    <button class="icon-btn" onclick={() => load()}>새로고침</button>
  </div>
  <LoadState {status} failText="대회 목록을 불러오지 못했어요." retry={load}>
    <ul class="admin-cups">
      {#each items as it (it.cup.id)}
        <li data-cup={it.cup.id}>
          <div class="row" style="gap:6px">
            <b>시즌 {it.cup.season} 제{it.cup.edition}회{it.cup.division ? ` ${DIVISION[it.cup.division]}` : ''}</b>
            {#if it.cup.division && it.cup.division !== 'master'}<span class="muted fs-xs" data-cup-cap>상한 {it.cup.ovrMax ?? '접수 때 자동'}</span>{/if}
            <span class="pill">{STATUS[it.status]}</span>
            <span class="muted fs-xs">신청 {it.entries}/{it.cup.capacity}</span>
          </div>
          <span class="muted fs-xs">
            접수 {kst(it.cup.opensAt)} · 결승 {kst(it.cup.rounds.at(-1)!.at)}
          </span>
          {#if it.status === 'scheduled' && it.cup.division && it.cup.division !== 'master'}
            <div class="row" style="gap:6px">
              <input type="number" min="1" max="120" style="width:80px" placeholder={String(suggest?.caps[it.cup.division === 'junior' ? 0 : 1] ?? '')} bind:value={capDraft[it.cup.id]} aria-label="OVR 상한" />
              <button class="icon-btn" data-act="cup-cap" disabled={busy || !capDraft[it.cup.id]} onclick={() => saveCap(it)}>상한 정하기</button>
              {#if suggest}<span class="muted fs-xs">지금 시즌 {suggest.season} 팀 {suggest.teams}개 기준 제안: {suggest.caps.join(' · ')}</span>{/if}
            </div>
          {/if}
          {#if it.status === 'scheduled' && (!it.cup.division || it.cup.division === 'master')}
            <div class="row"><button class="icon-btn" data-act="cup-delete" disabled={busy} onclick={() => remove(it)}>{it.cup.division ? '이 회차 지우기' : '지우기'}</button></div>
          {/if}
        </li>
      {:else}
        <li class="muted">대회가 없어요.</li>
      {/each}
    </ul>
  </LoadState>
</div>

<style>
  .cup-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .cup-form label { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-label, 13px); }
  .cup-plan { margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .cup-plan div { display: flex; gap: 8px; }
  .cup-plan dt { min-width: 36px; color: var(--muted); }
  .cup-plan dd { margin: 0; }
  .admin-cups { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .admin-cups li { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
</style>

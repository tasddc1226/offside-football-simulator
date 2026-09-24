<script lang="ts">
  // ui.ts renderRetired() 포트 (398~414줄)
  import { legendScore, legendTitle } from '../game/season.js';
  import { appState } from './state.svelte.js';
  import { goHome, goNew } from './actions.js';
  import { totals } from './format.js';
  import Topbar from './Topbar.svelte';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';

  const s = $derived(appState.G!);
  const t = $derived(totals(s));
  const e = $derived(appState.lastRetired || { score: legendScore(s) });
  const clubCount = $derived(new Set(s.career.map((r) => r.club)).size);
</script>

<div class="wrap">
  <Topbar />
  <section class="player">
    <div class="chalk"></div>
    <div>
      <div class="shirt">Full Time · No.{s.number}</div>
      <h2>{s.name}</h2>
      <div class="meta">{s.age}세 은퇴 · 마지막 소속 {s.club.name}</div>
    </div>
    <div class="ovr"><div class="n">{e.score}</div><div class="l">LEGEND</div></div>
    <div class="foot"><span class="pill role-주전">{legendTitle(e.score)}</span><span class="pill">최고 OVR {s.peak}</span></div>
  </section>
  <section class="card stack">
    <div class="eyebrow">Career Highlights</div>
    <div class="totals">
      <div><b>{t.p}</b><span>경기</span></div>
      {#if s.pos === 'GK' || s.pos === 'DF'}
        <div><b>{t.cs}</b><span>무실점</span></div>
        <div><b>{t.g + t.a}</b><span>공격P</span></div>
      {:else}
        <div><b>{t.g}</b><span>골</span></div>
        <div><b>{t.a}</b><span>도움</span></div>
      {/if}
      <div><b>{s.nat.caps}</b><span>A매치</span></div>
    </div>
    <p>{s.career.length}시즌 동안 {clubCount}개 팀에서 뛰며 트로피 {s.trophies.length}개, 개인상 {s.awards.length}개를 들어 올렸습니다.</p>
    <p class="muted" style="font-size:12px">레전드 점수 = 포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스</p>
  </section>
  <TrophyTab {s} />
  <CareerTab {s} />
  <button class="btn btn-primary btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
  <button class="btn btn-block" data-act="home" onclick={goHome}>명예의 전당 보기</button>
</div>

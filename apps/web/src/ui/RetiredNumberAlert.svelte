<script lang="ts">
  // T-10-076 영구결번 알림. 서버 어딘가에서 결번이 막 확정되면(홈 라이브 소켓, retiredNumber.svelte.ts) 어느 화면에
  // 있든 화면 위에 9초 띄운다 — 마우스를 올리거나 포커스가 있으면 기다린다. '보기'는 그 선수의 은퇴 상세를 연다.
  // 첫 소식이 올 때 App이 따로 불러온다(첫 화면 번들 밖). 다른 유저의 결번이라 구단은 그 유저가 바꿔 부른 이름이 아니라 게임 기본 이름으로.
  import { fly } from 'svelte/transition';
  import { defaultClubName } from '@offside/contracts/club-names';
  import { rnAlert } from './retiredNumber.svelte.js';
  import { openPublicLegendById } from './legend.js';
  import RnFrame from './RnFrame.svelte';
  import { dur } from './motion.js';
  import { legendRnText as L } from '@offside/app-core/i18n/ko/legendRn';
  import { personName } from '@offside/game/i18n/names';

  const SHOW_MS = 9_000;
  const item = $derived(rnAlert.item);
  let holding = $state(false);

  const close = () => (rnAlert.item = null);
  $effect(() => {
    if (!item || holding) return;
    const t = setTimeout(close, SHOW_MS);
    return () => clearTimeout(t);
  });
  function open() {
    const id = item!.careerId;
    close();
    void openPublicLegendById(id);
  }
</script>

{#if item}
  {#key item.seq}
    <div
      class="update-banner rn-alert"
      role="status"
      data-rn-alert={item.seq}
      transition:fly|global={{ y: -16, duration: dur(240) }}
      onmouseenter={() => (holding = true)}
      onmouseleave={() => (holding = false)}
      onfocusin={() => (holding = true)}
      onfocusout={() => (holding = false)}
    >
      <RnFrame class="rn-alert-frame" clubId={item.clubId} number={item.number} />
      <span class="news-text">
        <b>{L.alertTitle({ name: personName(item.name), number: item.number })}</b>
        <small>{L.alertSub({ club: defaultClubName(item.clubId) ?? item.club, seq: item.seq })}</small>
      </span>
      <button class="btn btn-accent btn-sm" data-act="rn-alert-open" onclick={open}>{L.alertOpen}</button>
      <button class="news-close" aria-label={L.alertClose} data-act="rn-alert-close" onclick={close}>✕</button>
    </div>
  {/key}
{/if}

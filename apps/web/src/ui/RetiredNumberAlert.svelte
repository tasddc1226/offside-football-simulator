<script lang="ts">
  // T-10-076 영구결번 알림. 서버 어딘가에서 결번이 막 확정되면(홈 라이브 소켓, retiredNumber.svelte.ts) 어느 화면에
  // 있든 화면 위에 9초 띄운다 — 마우스를 올리거나 포커스가 있으면 기다린다. '보기'는 그 선수의 은퇴 상세를 연다.
  // 첫 소식이 올 때 App이 따로 불러온다(첫 화면 번들 밖). 다른 유저의 결번이라 구단은 그 유저가 바꿔 부른 이름이 아니라 게임 기본 이름으로.
  import { fly } from 'svelte/transition';
  import { defaultClubName } from '@offside/contracts/club-names';
  import { rnAlert } from './retiredNumber.svelte.js';
  import { openPublicLegendById } from './legend.js';
  import { RN_SHIRT, RN_TRIM, rnStyle } from '@offside/app-core/rnStyle';
  import { dur } from './motion.js';

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
      style={rnStyle(item.clubId)}
      transition:fly|global={{ y: -16, duration: dur(240) }}
      onmouseenter={() => (holding = true)}
      onmouseleave={() => (holding = false)}
      onfocusin={() => (holding = true)}
      onfocusout={() => (holding = false)}
    >
      <svg class="rn-jersey rn-alert-shirt" viewBox="0 0 120 124" aria-hidden="true">
        <path class="rn-shirt" d={RN_SHIRT} />
        <path class="rn-trim" d={RN_TRIM} />
        <text class="rn-jersey-num" x="60" y="92">{item.number}</text>
      </svg>
      <span class="news-text">
        <b>👑 {item.name}, {item.number}번 영구결번</b>
        <small>{defaultClubName(item.clubId) ?? item.club} · 서버 {item.seq}번째 결번</small>
      </span>
      <button class="btn btn-accent btn-sm" data-act="rn-alert-open" onclick={open}>보기</button>
      <button class="news-close" aria-label="알림 닫기" data-act="rn-alert-close" onclick={close}>✕</button>
    </div>
  {/key}
{/if}

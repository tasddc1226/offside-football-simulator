<script lang="ts">
  // 라운지 대화 사이에 끼는 영구결번 배너. 테마와 무관하게 금색 명판으로 그린다.
  import { tn } from '@offside/game/i18n/names';
  import { playerName } from '@offside/app-core/format';
  import type { ChatNotice } from '@offside/contracts/chat';
  import { chatText as L } from '@offside/app-core/i18n/ko/chat';

  let { notice, onopen }: { notice: ChatNotice; onopen: (notice: ChatNotice) => void } = $props();

  const many = $derived(notice.n > 1);
  const club = $derived(tn(notice.club));
  const name = $derived(playerName(notice.name, notice.pos, notice.number));
</script>

<button
  class="plaque"
  class:many
  data-chat-notice={notice.n}
  aria-label={many
    ? L.noticeRetiredMany({ n: notice.n })
    : L.noticeRetired({ club, number: notice.number, name })}
  onclick={() => onopen(notice)}
>
  <span class="kit" aria-hidden="true">
    {#if many}
      <span class="shirt back left"></span>
      <span class="shirt back right"></span>
    {/if}
    <span class="shirt"><b>{notice.number}</b></span>
  </span>
  <span class="text">
    <span class="tag">{L.noticeRetiredTag}</span>
    <strong>{many ? L.noticeRetiredManyTitle({ n: notice.n }) : name}</strong>
    <small>
      {many
        ? L.noticeRetiredManySub({ name, others: notice.n - 1 })
        : L.noticeRetiredSub({ club, number: notice.number })}
    </small>
  </span>
  <span class="chev" aria-hidden="true">›</span>
</button>

<style>
  .plaque {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 72px;
    padding: 10px 14px 10px 12px;
    overflow: hidden;
    border: 1px solid #b98a2c;
    border-radius: 12px;
    background:
      radial-gradient(120% 160% at 0% 50%, rgb(240 180 55 / 0.26), transparent 58%),
      linear-gradient(100deg, #2b2009, #16140d 62%, #231a08);
    box-shadow:
      inset 0 1px 0 rgb(255 226 150 / 0.22),
      0 2px 10px rgb(0 0 0 / 0.22);
    color: #fbf6e8;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  /* 처음 나타날 때 빛이 한 번 지나간다. */
  .plaque::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 38%, rgb(255 232 170 / 0.24) 50%, transparent 62%);
    transform: translateX(-100%);
    animation: sweep 1.2s ease-out 0.15s 1;
    pointer-events: none;
  }
  @keyframes sweep {
    to {
      transform: translateX(100%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .plaque::after {
      animation: none;
    }
  }
  .plaque:hover {
    border-color: #e6b64c;
  }
  .plaque:focus-visible {
    outline: 2px solid #f0c75e;
    outline-offset: 2px;
  }
  .kit {
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 54px;
    height: 50px;
  }
  .many .kit {
    width: 62px;
  }
  .shirt {
    position: relative;
    display: grid;
    place-items: center;
    width: 50px;
    height: 48px;
    padding-top: 7px;
    box-sizing: border-box;
    background: linear-gradient(160deg, #ffe39a, #e0a92f 55%, #a97716);
    clip-path: polygon(31% 0, 40% 7%, 60% 7%, 69% 0, 100% 20%, 88% 42%, 78% 36%, 78% 100%, 22% 100%, 22% 36%, 12% 42%, 0 20%);
  }
  .shirt.back {
    position: absolute;
    top: 3px;
    width: 40px;
    height: 40px;
    background: linear-gradient(160deg, #a98231, #6d5216);
  }
  .shirt.left {
    left: 0;
    transform: rotate(-13deg);
  }
  .shirt.right {
    right: 0;
    transform: rotate(13deg);
  }
  .shirt b {
    color: #2a1c00;
    font-family: var(--display);
    font-size: 20px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.3;
    word-break: keep-all;
  }
  .tag {
    color: #f0c75e;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  strong {
    margin-top: 1px;
    font-size: 16px;
    font-weight: 800;
  }
  small {
    margin-top: 1px;
    color: #d7cdb4;
    font-size: 12.5px;
  }
  .chev {
    flex: none;
    color: #f0c75e;
    font-size: 20px;
    font-weight: 700;
  }
</style>

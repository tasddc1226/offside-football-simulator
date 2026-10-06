<script lang="ts">
  // T-11-130 홈 섹션 머리의 '더보기 ›'. 상자 버튼('전체 보기') 대신 글자와 오른쪽 꺾쇠로 다른 화면으로 넘어간다는 것을 보인다.
  import { homeText as L } from '@offside/app-core/i18n/ko/home';

  let { act, what, onclick }: { act: string; what: string; onclick: () => void } = $props();
</script>

<button type="button" class="more-link" data-act={act} aria-label={L.moreAria({ what })} {onclick}>
  {L.more}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
</button>

<style>
  .more-link {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 1px;
    min-height: 44px;
    padding: 0 0 0 10px;
    border: 0;
    background: none;
    color: var(--accent-text);
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
  }
  .more-link:active {
    opacity: 0.6;
  }
  svg {
    transition: translate 0.16s ease-out;
  }
  @media (hover: hover) {
    .more-link:hover svg {
      translate: 2px 0;
    }
  }
</style>

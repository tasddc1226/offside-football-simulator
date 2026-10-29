<script lang="ts">
  // T-11-562 시즌 고르기 칸(웹 공용). 칸에는 이름과 작은 상태 글자('진행 중'), 펼친 목록에는 기간 · 상태까지 보인다(최신 시즌이 위).
  // 목록은 브라우저 기본 <select>를 그대로 써서 키보드 · 스크린 리더 · 휴대폰 고르기 창이 따라온다. 칸 글자만 위에 덮는다.
  import { seasonChoices } from '@offside/app-core/seasonPick';
  import { seasonNow } from './seasonNow.svelte.js';

  type Value = number | 'all';
  let {
    value,
    seasons,
    onpick,
    label,
    caption,
    all,
    compact = false,
    ...rest
  }: {
    value: Value;
    /** 고를 수 있는 시즌: id만, 또는 서버 목록({ id, name }). 순서는 상관없다. */
    seasons: readonly (number | { id: number; name?: string })[];
    onpick: (v: Value) => void;
    /** 스크린 리더 이름. */
    label: string;
    /** 칸 위에 보이는 작은 이름(없으면 그리지 않는다). */
    caption?: string;
    /** '전체 시즌' 같은 맨 위 항목 이름. 주면 'all'을 고를 수 있다. */
    all?: string;
    /** 머리줄 안에 들어가는 작은 칸. */
    compact?: boolean;
    [attr: `data-${string}`]: unknown;
  } = $props();

  const clock = seasonNow();
  const choices = $derived(seasonChoices(seasons, clock.now));
  const picked = $derived(value === 'all' ? undefined : choices.find((c) => c.id === value));
</script>

<label class="season-select" class:compact>
  {#if caption}<span class="ss-caption">{caption}</span>{/if}
  <span class="ss-box" data-season-status={picked?.status ?? 'all'}>
    <span class="ss-face" aria-hidden="true"><span class="ss-label"><span class="ss-text">{picked ? picked.name : (all ?? '')}</span>{#if picked?.tag}<span class="ss-tag">{picked.tag}</span>{/if}</span><svg viewBox="0 0 12 12"><path d="M3 4.5 6 7.5 9 4.5" /></svg></span>
    <select {...rest} aria-label={label} value={String(value)} onchange={(e) => {
      const v = e.currentTarget.value;
      onpick(v === 'all' ? 'all' : Number(v));
    }}>
      {#if all}<option value="all">{all}</option>{/if}
      {#each choices as c (c.id)}<option value={String(c.id)}>{c.row}</option>{/each}
    </select>
  </span>
</label>

<style>
  .season-select {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .ss-caption {
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .ss-box {
    position: relative;
    display: block;
    min-width: 0;
  }
  .ss-face {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 4px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--ink);
    font-size: max(0.9375rem, 15px);
    font-weight: 600;
  }
  /* 이름과 상태를 한 줄 높이에 둔다. 칸이 좁으면 상태 글자가 다음 줄로 밀려 가려지고 점과 이름만 남는다. */
  .ss-label {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    column-gap: 8px;
    min-width: 0;
    height: 1.4em;
    line-height: 1.4;
    overflow: hidden;
  }
  .ss-text {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ss-tag {
    flex: none;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .ss-face svg {
    flex: none;
    width: 12px;
    height: 12px;
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  [data-season-status='live'] .ss-text::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 6px;
    border-radius: 50%;
    background: var(--accent);
    vertical-align: 0.1em;
  }
  /* 기본 목록은 칸 위에 투명하게 겹쳐 누르면 바로 열린다(휴대폰은 16px 미만이면 확대되므로 글자 크기를 둔다). */
  select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 16px;
  }
  .ss-box:focus-within .ss-face {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .ss-box:hover .ss-face {
    border-color: var(--muted);
  }
  .compact .ss-face {
    min-height: 36px;
    padding: 2px 10px;
    font-size: 13px;
  }
</style>

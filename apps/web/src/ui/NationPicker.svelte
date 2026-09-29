<script lang="ts">
  // T-10-099 국적 고르기: 한글·초성으로 찾는 콤보박스. 연맹별로 묶어 가나다순, 대한민국은 맨 위.
  import { CONFEDS, CONF_ORDER, DEFAULT_NATION, NATIONS } from '@offside/contracts/nations';
  import { KR, flagOf, nationOf, type Nation } from '@offside/game/nation';
  import { koMatchAt } from '@offside/app-core/koSearch';
  import { motionOK } from './motion.js';

  let { id, value = $bindable() }: { id: string; value: string } = $props();

  const byKo = new Intl.Collator('ko').compare;
  const GROUPS = [
    { key: 'KR', label: '기본', list: [KR] },
    ...CONF_ORDER.map((conf) => ({
      key: conf,
      label: `${CONFEDS[conf].region} (${conf})`,
      list: NATIONS.filter((n) => n.conf === conf && n.code !== DEFAULT_NATION).sort((a, b) => byKo(a.ko, b.ko)),
    })),
  ];

  let open = $state(false);
  // null = 아직 안 쳤다(선택된 이름을 보여 주고 전체 목록).
  let query = $state<string | null>(null);
  let active = $state(0);
  let input: HTMLInputElement;
  let root: HTMLDivElement;
  let list = $state<HTMLDivElement>();

  const selected = $derived(nationOf({ nation: value }));
  // 검색 중엔 연맹 묶음 대신 한 목록으로, 이름이 검색어로 시작하는 나라부터.
  const groups = $derived.by(() => {
    if (!query) return GROUPS;
    const hits = NATIONS.map((n) => ({ n, at: koMatchAt(n.ko, query!) }))
      .filter((h) => h.at >= 0)
      .sort((a, b) => a.at - b.at || byKo(a.n.ko, b.n.ko));
    return hits.length ? [{ key: 'hits', label: `검색 결과 ${hits.length}`, list: hits.map((h) => h.n) }] : [];
  });
  const flat = $derived(groups.flatMap((g) => g.list));
  const cur = $derived<Nation | undefined>(flat[active]);
  const optId = (n: Nation) => `${id}-o-${n.code}`;

  function show() {
    if (open) return;
    open = true;
    query = null;
    active = Math.max(0, flat.findIndex((n) => n.code === value));
    input.select();
    // 폰에선 키보드가 올라와 아래 목록을 가리므로 입력 칸을 화면 위쪽으로 올린다(여백은 scroll-margin-top).
    if (matchMedia('(pointer: coarse)').matches) setTimeout(() => root.scrollIntoView({ block: 'start', behavior: motionOK ? 'smooth' : 'auto' }), 300);
  }
  function hide() {
    open = false;
    query = null;
  }
  function pick(n: Nation) {
    value = n.code;
    hide();
    input.blur();
  }
  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return show();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + flat.length) % Math.max(1, flat.length);
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (cur) pick(cur);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      hide();
    }
  }

  // T-10-118 iOS 의 vh 는 키보드를 빼지 않아 목록이 키보드 뒤로 밀린다 — 열려 있는 동안 visualViewport 높이로 상한을 잡는다.
  // 지원하지 않으면 변수가 없어 CSS 의 40vh 로 남는다.
  $effect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const sync = () => root.style.setProperty('--combo-vvh', `${vv.height}px`);
    sync();
    vv.addEventListener('resize', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      root.style.removeProperty('--combo-vvh');
    };
  });

  // 키보드로 움직인 항목이 목록 밖으로 나가지 않게.
  $effect(() => {
    if (!open || !cur) return;
    list?.querySelector(`#${optId(cur)}`)?.scrollIntoView({ block: 'nearest' });
  });
</script>

<div class="combo" class:open bind:this={root}>
  <span class="combo-flag" aria-hidden="true">{flagOf(selected.code)}</span>
  <input
    {id}
    bind:this={input}
    type="text"
    role="combobox"
    autocomplete="off"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-activedescendant={open && cur ? optId(cur) : undefined}
    data-value={value}
    placeholder="나라 이름이나 초성(ㅂㄹㅈ)"
    value={query ?? selected.ko}
    onfocus={show}
    onclick={show}
    oninput={(e) => {
      open = true;
      query = e.currentTarget.value;
      active = 0;
    }}
    {onkeydown}
    onblur={hide}
  />
  <span class="combo-caret" aria-hidden="true">▾</span>
  {#if open}
    <div class="combo-list" id="{id}-list" role="listbox" aria-label="국적" bind:this={list}>
      {#each groups as g (g.key)}
        <div role="group" aria-labelledby="{id}-g-{g.key}">
          <div class="combo-group" id="{id}-g-{g.key}">{g.label}</div>
          {#each g.list as n (n.code)}
            <!-- 목록을 누르는 동안 입력 칸이 초점을 잃지 않게 pointerdown을 막는다. 키보드 선택은 입력 칸이 맡는다. -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="combo-opt"
              class:active={cur === n}
              id={optId(n)}
              role="option"
              tabindex="-1"
              aria-selected={n.code === value}
              data-nation={n.code}
              onpointerdown={(e) => e.preventDefault()}
              onclick={() => pick(n)}
            >
              <span aria-hidden="true">{flagOf(n.code)}</span>
              {n.ko}
            </div>
          {/each}
        </div>
      {:else}
        <div class="combo-empty">찾는 나라가 없어요</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .combo {
    position: relative;
  }
  .combo input {
    padding-inline: 40px 34px;
    text-overflow: ellipsis;
  }
  .combo-flag,
  .combo-caret {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .combo-flag {
    left: 13px;
    font-size: 1.125rem;
  }
  .combo-caret {
    right: 13px;
    color: var(--muted);
    transition: transform 0.15s;
  }
  .open .combo-caret {
    transform: translateY(-50%) rotate(180deg);
  }
  .combo-list {
    position: absolute;
    z-index: 7;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    /* --combo-vvh 는 T-10-118 (키보드가 올라오면 visualViewport 높이). 없으면 100vh 라 기존 40vh 와 같다. */
    max-height: min(300px, calc(var(--combo-vvh, 100vh) * 0.4));
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 4px;
  }
  .combo-group {
    position: sticky;
    top: -4px;
    padding: 8px 10px 4px;
    background: var(--surface);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .combo-opt {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px;
    border-radius: 8px;
    cursor: pointer;
  }
  .combo-opt.active {
    background: var(--surface-2);
  }
  .combo-opt[aria-selected='true'] {
    font-weight: 700;
    color: var(--accent-text);
  }
  .combo-empty {
    padding: 14px 10px;
    color: var(--muted);
    text-align: center;
  }
</style>

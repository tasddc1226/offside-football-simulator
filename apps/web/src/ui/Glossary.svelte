<script lang="ts">
  // T-11-732 용어 사전(앱 screens/hof/Glossary.tsx). 확률 도감의 접는 칸이고, 항목 · 순서는 app-core glossary가 정한다.
  // 설정 · "?" 설명 창에서 들어오면 펼친 채로 이 칸까지 내려 준다.
  import { onMount } from 'svelte';
  import { glossaryGroups } from '@offside/app-core/glossary';
  import { glossaryText as L } from '@offside/app-core/i18n/ko/glossary';

  let { open = false }: { open?: boolean } = $props();
  const groups = glossaryGroups();
  let el = $state<HTMLDetailsElement | null>(null);
  onMount(() => {
    if (open) el?.scrollIntoView({ block: 'start' });
  });
</script>

<details class="dex-rules" id="glossary" data-glossary bind:this={el} {open}>
  <summary><b>{L.title}</b></summary>
  <p class="muted fs-sm" style="margin:8px 0 0">{L.intro}</p>
  {#each groups as g (g.id)}
    <h3 class="gl-h" data-glossary-group={g.id}>{g.name}</h3>
    <dl>
      {#each g.terms as t (t.id)}
        <dt data-term={t.id}>{t.term}</dt>
        <dd>{t.desc}</dd>
      {/each}
    </dl>
  {/each}
</details>

<style>
  .gl-h { font-size: var(--fs-label); margin: 16px 0 0; }
</style>

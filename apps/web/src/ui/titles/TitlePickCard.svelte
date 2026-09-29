<script lang="ts">
  // 은퇴한 내 선수의 대표 칭호 고르기(은퇴 화면·내 선수 상세 아래). 받은 칭호 목록은 접어 두고, 펼쳐서 고르면 선수
  // 카드·명예의 전당·공유 링크의 대표 칭호가 바뀐다. 이 기기 기록(ft_hof)에 남기고 서버에 다시 올린다 — 서버는 은퇴 때
  // 올라온 상세 기록의 칭호 목록에 있는 것만 받는다.
  import { loadHOF, saveKey } from '@offside/game/season';
  import { titleById } from '@offside/game/titles';
  import { earnedTitles } from '@offside/app-core/legendReport';
  import type { HofEntry } from '@offside/game/types';
  import { toast, uploadRetirement } from '../helpers.js';
  import { legendTitleOf, picked } from './legendTitle.svelte.js';
  import TitleTag from './TitleTag.svelte';

  const { h }: { h: HofEntry } = $props();
  const earned = $derived(earnedTitles(h));
  const current = $derived(titleById(legendTitleOf(h.id, h.title)));
  let open = $state(false);

  function pick(id: string) {
    open = false;
    if (!h.id) return;
    picked[h.id] = id;
    h.title = id;
    const hof = loadHOF();
    const saved = hof.find((x) => x.id === h.id);
    if (saved) saved.title = id;
    saveKey('ft_hof', hof);
    uploadRetirement(h.id, h);
    toast(`대표 칭호를 ‘${titleById(id)?.name ?? id}’(으)로 바꿨습니다.`);
  }
</script>

{#if earned.length > 1}
  <section class="card stack" data-legend-titles>
    <div><div class="eyebrow">Titles</div><h2>대표 칭호</h2></div>
    <p class="title-main">
      {#if current}<TitleTag name={current.name} rarity={current.rarity} />{:else}<span class="muted">없음</span>{/if}
    </p>
    <details class="title-pick" bind:open>
      <summary data-act="legend-title-open">받은 칭호 {earned.length}개 중에서 바꾸기</summary>
      {#if open}
        <ul class="title-list">
          {#each earned as x (x.d.id)}
            <li>
              <button class="title-item" data-legend-title-pick={x.d.id} aria-pressed={current?.id === x.d.id} onclick={() => pick(x.d.id)}>
                <TitleTag name={x.d.name} rarity={x.d.rarity} />
                <span class="title-desc">{x.d.desc}</span>
                <span class="title-year num">{x.year ? x.year : '이전 기록'}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </details>
    <p class="muted fs-xs">고른 칭호는 선수 카드와 명예의 전당·공유 링크에 표시됩니다.</p>
  </section>
{/if}

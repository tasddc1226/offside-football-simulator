<script lang="ts">
  // T-10-079 은퇴한 내 선수의 SNS 공유용 한 장 이미지. 누르면 그리고(shareCard.ts), 미리 보기와 함께 휴대폰은 공유 시트로
  // 바로(인스타·카톡), 공유 시트가 없는 브라우저는 PNG로 저장한다. OwnHofCards가 따로 불러온다(첫 화면 번들 밖) — 그리는
  // 코드를 한 단계 더 나눠 불러오면 청크가 갈라져 첫 화면 번들이 오히려 커진다.
  import type { HofEntry } from '../../game/types.js';
  import { viewFromEntry } from '../legend.js';
  import { legendTitleOf } from '../titles/legendTitle.svelte.js';
  import { toast } from '../helpers.js';
  import { cardFile, drawShareCard, loadCardFonts, shareCardData } from './shareCard.js';

  const { h }: { h: HofEntry } = $props();

  let file = $state<File | null>(null);
  let url = $state<string | null>(null);
  let busy = $state(false);
  $effect(() => () => {
    if (url) URL.revokeObjectURL(url);
  });

  async function make() {
    if (busy) return;
    busy = true;
    try {
      await loadCardFonts();
      const canvas = document.createElement('canvas');
      drawShareCard(canvas, shareCardData(viewFromEntry(h), legendTitleOf(h.id, h.title)));
      const f = await cardFile(canvas, h.name);
      if (url) URL.revokeObjectURL(url);
      file = f;
      url = URL.createObjectURL(f);
    } catch {
      toast('이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      busy = false;
    }
  }

  const canShare = $derived(!!file && !!navigator.canShare?.({ files: [file] }));

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: `${h.name}의 축구 인생 — 오프사이드 offside-lab.com` });
    } catch (e) {
      // 공유 시트를 닫은 건 실패가 아니다.
      if ((e as DOMException)?.name !== 'AbortError') save();
    }
  }

  function save() {
    if (!file || !url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  }
</script>

<section class="card stack" data-share-image>
  <div><div class="eyebrow">Share</div><h2>SNS 공유 이미지</h2></div>
  {#if url}
    <img class="share-image" src={url} alt="{h.name} 커리어 공유 이미지" width="1080" height="1350" data-share-image-preview />
    <div class="share-actions">
      <button class="btn" data-act="share-image-save" onclick={save}>이미지 저장</button>
      {#if canShare}
        <button class="btn btn-primary" data-act="share-image-send" onclick={share}>바로 공유하기</button>
      {:else}
        <button class="btn btn-primary" data-act="share-image-remake" onclick={make} disabled={busy}>다시 만들기</button>
      {/if}
    </div>
  {:else}
    <p class="muted fs-sm">인스타그램·카카오톡에 바로 올릴 수 있는 한 장짜리 커리어 카드를 만들어요.</p>
    <button class="btn btn-primary btn-block" data-act="share-image-make" onclick={make} disabled={busy}>
      {busy ? '만드는 중…' : '공유 이미지 만들기'}
    </button>
  {/if}
</section>

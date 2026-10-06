<script lang="ts">
  // T-10-079 은퇴한 내 선수의 SNS 공유용 한 장 이미지. 누르면 그리고(shareCard.ts), 미리 보기와 함께 휴대폰은 공유 시트로
  // 바로(인스타·카톡), 공유 시트가 없는 브라우저는 PNG로 저장한다. OwnHofCards가 따로 불러온다(첫 화면 번들 밖) — 그리는
  // 코드를 한 단계 더 나눠 불러오면 청크가 갈라져 첫 화면 번들이 오히려 커진다.
  // 카드 내용은 위 은퇴 리포트와 같은 LegendView(v)에서 뽑는다 — 영구결번도 리포트처럼 이번 접속의 심사 결과를 먼저 본다.
  import type { LegendView } from '../state.svelte.js';
  import { legendTitleOf } from '../titles/legendTitle.svelte.js';
  import { rnOf } from '../retiredNumber.svelte.js';
  import { toast } from '../helpers.js';
  import { cardFile, drawShareCard, loadCardFonts, shareCardData } from './shareCard.js';
  import { shareText as L } from '@offside/app-core/i18n/ko/share';

  const { v }: { v: LegendView } = $props();
  const h = $derived(v.own!);

  let shot = $state<{ file: File; url: string; canShare: boolean } | null>(null);
  let busy = $state(false);
  $effect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  });

  async function make() {
    if (busy) return;
    busy = true;
    try {
      const data = shareCardData({ ...v, rn: rnOf(h.id!, v.rn) }, legendTitleOf(h.id, h.title));
      await loadCardFonts(data);
      const canvas = document.createElement('canvas');
      drawShareCard(canvas, data);
      const file = await cardFile(canvas, h.name);
      canvas.width = 0; // 큰 캔버스 메모리를 바로 놓는다(iOS 사파리 캔버스 한도).
      if (shot) URL.revokeObjectURL(shot.url);
      shot = { file, url: URL.createObjectURL(file), canShare: !!navigator.canShare?.({ files: [file] }) };
    } catch {
      toast(L.imageFailed);
    } finally {
      busy = false;
    }
  }

  async function share() {
    if (!shot) return;
    try {
      await navigator.share({ files: [shot.file], text: L.imageText({ name: h.name }) });
    } catch (e) {
      // 공유 시트를 닫은 건 실패가 아니다.
      if ((e as DOMException)?.name !== 'AbortError') save();
    }
  }

  function save() {
    if (!shot) return;
    Object.assign(document.createElement('a'), { href: shot.url, download: shot.file.name }).click();
  }
</script>

<section class="card stack" data-share-image>
  <div><div class="eyebrow">Share</div><h2>{L.imageTitle}</h2></div>
  {#if shot}
    <img class="share-image" src={shot.url} alt={L.imageAlt({ name: h.name })} width="1080" height="1350" data-share-image-preview />
    <div class="share-actions">
      <button class="btn" data-act="share-image-save" onclick={save}>{L.imageSave}</button>
      {#if shot.canShare}
        <button class="btn btn-primary" data-act="share-image-send" onclick={share}>{L.imageSend}</button>
      {:else}
        <!-- 대표 칭호를 바꾼 뒤 다시 그릴 때. -->
        <button class="btn btn-primary" data-act="share-image-remake" onclick={make} disabled={busy}>{L.imageRemake}</button>
      {/if}
    </div>
  {:else}
    <p class="muted fs-sm">{L.imageNote}</p>
    <button class="btn btn-primary btn-block" data-act="share-image-make" onclick={make} disabled={busy}>
      {busy ? L.imageMaking : L.imageMake}
    </button>
  {/if}
</section>

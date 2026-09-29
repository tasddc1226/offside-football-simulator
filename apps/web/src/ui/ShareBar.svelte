<script lang="ts">
  // T-10-029 → T-10-067 은퇴 커리어 공유. 내 은퇴 선수 화면(은퇴 직후·선수 상세) 아래에 고정된 버튼으로, 로그인하지
  // 않아도 보기 전용 공유 링크(/career/<id>)를 복사한다 — 링크는 공개 명예의 전당 상세라 로그인과 무관하다.
  // T-10-069 이 기기에 없는 계정의 내 선수도 띄운다 — 띄울지는 LegendView.shareId(legend.ts)가 정한다. 왼쪽 반은 홈으로.
  import { trackShareClick, trackShareSuccess } from '../analytics/index.js';
  import { getHofDetail } from '../api/client.js';
  import { toast } from './helpers.js';
  import { goHome } from './nav.js';
  import { shareUrl } from './legend.js';
  import ActionBar from './ActionBar.svelte';

  const { id }: { id: string } = $props();
  let busy = $state(false);
  let url = $state<string | null>(null);

  // 링크를 서버에 확인한 뒤 공유한다 — T-10-118 네이티브 공유 시트(navigator.share)가 있으면 그걸 먼저 쓰고,
  // 없거나 실패하면 클립보드로 복사한다.
  // Safari 는 클릭 제스처가 끝난 뒤(await 이후)의 클립보드 쓰기를 막으므로, 쓰기는 클릭 안에서 바로 시작하고
  // 내용은 확인이 끝나면 채워지는 Promise 로 넘긴다.
  async function checkLink(): Promise<string> {
    // 은퇴 기록이 아직 서버에 안 올라갔으면(오프라인이었거나 막 은퇴한 직후) 링크가 404다 — 먼저 보내 본다.
    await import('../sync/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
    const r = await getHofDetail(id);
    if (!r.ok) {
      throw new Error(
        r.error.reason === 'HOF_NOT_FOUND' ? '기록을 아직 서버에 올리지 못했어요. 잠시 후 다시 시도해 주세요.' : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
    return shareUrl(id);
  }

  // 클립보드 복사. link 는 확인이 끝나면 채워지는 Promise 다(위 주석 참고).
  async function copyLink(link: Promise<string>) {
    let copied: Promise<void>;
    try {
      const blob = link.then((l) => new Blob([l], { type: 'text/plain' }));
      copied = navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    } catch {
      // ClipboardItem 을 못 쓰는 브라우저: 확인이 끝난 뒤 텍스트로 쓴다.
      copied = link.then((l) => navigator.clipboard.writeText(l));
    }
    try {
      url = await link;
    } catch (e) {
      copied.catch(() => {});
      return toast((e as Error).message);
    }
    try {
      await copied;
      trackShareSuccess();
      toast('공유 링크를 복사했어요.');
    } catch {
      toast('위 링크를 복사해 공유해 주세요.');
    }
  }

  async function copy() {
    if (busy) return;
    busy = true;
    trackShareClick();
    try {
      // 한 번 확인한 링크는 다시 서버에 묻지 않는다.
      const link = url ? Promise.resolve(url) : checkLink();
      // T-10-118 네이티브 공유 시트 우선. 사용자가 닫으면(AbortError) 조용히 끝내고, 못 쓰면 복사로 넘어간다.
      // 확인(await) 뒤엔 제스처가 끝나 막힐 수 있는데, 그때도 링크는 url 에 남아 다음 탭은 바로 공유 시트로 간다.
      if (typeof navigator.share === 'function') {
        let l: string;
        try {
          l = await link;
        } catch (e) {
          return toast((e as Error).message);
        }
        url = l;
        const data = { title: '오프사이드 — 은퇴 커리어', text: '내 선수의 축구 인생 — 오프사이드 offside-lab.com', url: l };
        if (navigator.canShare?.(data) !== false) {
          try {
            await navigator.share(data);
            trackShareSuccess();
            return;
          } catch (e) {
            if ((e as Error).name === 'AbortError') return;
          }
        }
      }
      await copyLink(link);
    } finally {
      busy = false;
    }
  }
</script>

<ActionBar data-share="bar">
  {#if url}
    <input class="share-url" readonly value={url} aria-label="공유 링크" onfocus={(e) => e.currentTarget.select()} />
  {/if}
  <div class="share-actions">
    <button class="btn" data-act="share-home" onclick={goHome}>홈으로</button>
    <button class="btn btn-primary" data-act="share-career" disabled={busy} onclick={copy}>
      {busy ? '링크 만드는 중…' : url ? '링크 다시 복사' : '커리어 공유하기'}
    </button>
  </div>
</ActionBar>

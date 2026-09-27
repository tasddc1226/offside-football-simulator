<script lang="ts">
  // T-10-029 → T-10-067 은퇴 커리어 공유. 내 은퇴 선수 화면(은퇴 직후·선수 상세) 아래에 고정된 버튼으로, 로그인하지
  // 않아도 보기 전용 공유 링크(/career/<id>)를 복사한다 — 링크는 공개 명예의 전당 상세라 로그인과 무관하다.
  // 짧은 커리어(T-10-032)는 서버 명예의 전당에 오르지 않아 링크가 없으므로 그리지 않는다.
  import { isHofEligible } from '@offside/contracts/hof-rules';
  import { getHofDetail } from '../api/client.js';
  import type { HofEntry } from '../game/types.js';
  import { toast } from './helpers.js';
  import { shareUrl } from './legend.js';

  const { h }: { h: HofEntry } = $props();
  let busy = $state(false);
  let url = $state<string | null>(null);

  // 링크를 서버에 확인한 뒤 클립보드로 복사만 한다(네이티브 공유 시트는 띄우지 않는다).
  // Safari 는 클릭 제스처가 끝난 뒤(await 이후)의 클립보드 쓰기를 막으므로, 쓰기는 클릭 안에서 바로 시작하고
  // 내용은 확인이 끝나면 채워지는 Promise 로 넘긴다.
  async function checkLink(id: string): Promise<string> {
    // 은퇴 기록이 아직 서버에 안 올라갔으면(오프라인이었거나 막 은퇴한 직후) 링크가 404다 — 먼저 보내 본다.
    await import('../game/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
    const r = await getHofDetail(id);
    if (!r.ok) {
      throw new Error(
        r.error.reason === 'HOF_NOT_FOUND' ? '기록을 아직 서버에 올리지 못했어요. 잠시 후 다시 시도해 주세요.' : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
    return shareUrl(id);
  }

  async function copy(id: string) {
    busy = true;
    // 한 번 확인한 링크는 다시 서버에 묻지 않는다.
    const link = url ? Promise.resolve(url) : checkLink(id);
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
    } finally {
      busy = false;
    }
    try {
      await copied;
      toast('공유 링크를 복사했어요.');
    } catch {
      toast('위 링크를 복사해 공유해 주세요.');
    }
  }
</script>

{#if h.id && isHofEligible(h.age)}
  {@const id = h.id}
  <div class="sharebar-space" class:open={url} aria-hidden="true"></div>
  <div class="action-bar at-bottom" data-share="bar">
    <div class="action-bar-inner stack">
      {#if url}
        <input class="share-url" readonly value={url} aria-label="공유 링크" onfocus={(e) => e.currentTarget.select()} />
      {/if}
      <button class="btn btn-primary btn-block" data-act="share-career" disabled={busy} onclick={() => copy(id)}>
        {busy ? '링크 만드는 중…' : url ? '공유 링크 다시 복사하기' : '커리어 공유하기'}
      </button>
    </div>
  </div>
{/if}

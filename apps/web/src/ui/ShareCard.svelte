<script lang="ts">
  // T-10-029 은퇴 커리어 공유. 구글 로그인한 유저는 보기 전용 공유 링크(/career/<id>)를 만들고, 로그인하지
  // 않은 유저에게는 로그인을 권한다(로그인을 마치면 이 선수 상세로 돌아온다). 서버에 연결하지 못하면 숨긴다.
  import { onMount, tick } from 'svelte';
  import { getHofDetail } from '../api/client.js';
  import type { HofEntry } from '../game/types.js';
  import { accountCache, refreshAccount } from './account-state.svelte.js';
  import { startGoogleLogin } from './actions.js';
  import { toast } from './helpers.js';
  import { shareFocus, shareUrl } from './legend.js';

  // 부모가 id 있는 선수(서버에 올라간 은퇴 기록)에만 그린다.
  const { h }: { h: HofEntry } = $props();
  const id = $derived(h.id!);
  const profile = $derived(accountCache.value);
  let el = $state<HTMLElement | null>(null);
  let busy = $state(false);
  let url = $state<string | null>(null);

  onMount(async () => {
    if (accountCache.value === undefined || accountCache.value === 'error') await refreshAccount();
    if (!shareFocus.pending) return;
    shareFocus.pending = false;
    await tick();
    el?.scrollIntoView({ block: 'center' });
  });

  async function share() {
    busy = true;
    // 은퇴 기록이 아직 서버에 안 올라갔으면(오프라인이었거나 막 은퇴한 직후) 링크가 404다 — 먼저 보내 본다.
    await import('../game/outbox.js').then((m) => m.flushOutbox()).catch(() => {});
    const r = await getHofDetail(id);
    busy = false;
    if (!r.ok) {
      return toast(
        r.error.code === 'HOF_NOT_FOUND' ? '기록을 아직 서버에 올리지 못했어요. 잠시 후 다시 시도해 주세요.' : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
    const link = shareUrl(id);
    url = link;
    const title = `${h.public ? h.name : '내 선수'}의 은퇴 커리어 · 오프사이드`;
    if (navigator.share) {
      try {
        return await navigator.share({ title, text: `레전드 점수 ${h.score}점으로 은퇴했어요.`, url: link });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast('공유 링크를 복사했어요.');
    } catch {
      toast('아래 링크를 복사해 공유해 주세요.');
    }
  }
</script>

{#if profile && profile !== 'error' && profile.linked.google}
  <section class="card stack" data-share="ready" bind:this={el}>
    <div><div class="eyebrow">Share</div><h2>커리어 공유하기</h2></div>
    <p class="muted" style="font-size:13px">
      링크를 받은 사람은 이 은퇴 리포트를 보기만 할 수 있어요. 선수 이름은 명예의 전당 이름 공개를 켰을 때만 보입니다.
    </p>
    <button class="btn btn-primary btn-block" data-act="share-career" disabled={busy} onclick={share}>
      {busy ? '링크 만드는 중…' : '공유하기'}
    </button>
    {#if url}
      <input class="share-url" readonly value={url} aria-label="공유 링크" onfocus={(e) => e.currentTarget.select()} />
    {/if}
  </section>
{:else if profile !== undefined && profile !== 'error'}
  <section class="card stack" data-share="login" bind:this={el}>
    <div><div class="eyebrow">Share</div><h2>로그인하고 커리어를 공유하세요</h2></div>
    <p class="muted" style="font-size:13px">
      구글로 로그인하면 이 은퇴 기록이 계정에 남아 다른 기기에서도 볼 수 있고, 친구에게 보여 줄 공유 링크를 만들 수 있어요.
    </p>
    <button class="btn btn-primary btn-block" data-act="share-login" onclick={() => startGoogleLogin({ career: id })}>구글로 로그인</button>
  </section>
{/if}

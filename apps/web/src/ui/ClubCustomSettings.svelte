<script lang="ts">
  // 설정 화면의 "구단 이름·엠블럼 변경" 카드(T-10-009) — 리그별 클럽 이름·엠블럼 편집, 에디트 파일 내보내기/가져오기.
  import { LEAGUES } from '../game/data.js';
  import { CLUB_NAME_MAX, LOGO_TEXT_MAX, logoOf, type ClubLogo } from '../game/clubs.js';
  import { CLUB_CUSTOM_IMG_MAX, CLUB_CUSTOM_IMG_TOTAL_MAX, clubImgTotal } from '@offside/contracts/club-limits';
  import { clubsIn } from '../game/engine.js';
  import { clubCustom, setClubCustom, resetClubCustom, exportClubCustom, importClubCustom } from './clubCustom.svelte.js';
  import { toast } from './helpers.js';
  import ClubBadge from './ClubBadge.svelte';

  let clubsOpen = $state(false);
  let leagueId = $state(LEAGUES[LEAGUES.length - 1]!.id);
  let open = $state<string | null>(null);
  // 이름 편집 결과가 다시 CLUBS에서 읽히도록 clubCustom.map을 의존성에 건다.
  const clubs = $derived((void clubCustom.map, clubsIn(leagueId).map((c) => ({ ...c }))));

  const fail = () => toast('저장 공간이 부족해 저장하지 못했어요');
  const SYNC_TEXT = {
    local: '이 기기에만 저장됩니다 — 구글 계정으로 로그인하면 다른 기기와 동기화돼요.',
    syncing: '계정과 동기화하는 중…',
    synced: '계정에 저장됨 — 같은 계정으로 로그인한 기기에서 함께 쓰여요.',
    error: '동기화하지 못했어요 — 이 기기에는 저장됐고, 다음에 다시 시도합니다.',
    full: '엠블럼 이미지가 너무 많아 계정과 동기화하지 못해요 — 이 기기에는 저장됐어요. 이미지를 몇 개 지우면 다시 동기화돼요.',
  } as const;

  function rename(id: string, value: string) {
    if (!setClubCustom(id, { name: value })) fail();
  }
  function editLogo(club: { id: string; name: string }, patch: Partial<ClubLogo>) {
    if (!setClubCustom(club.id, { logo: { ...logoOf(club, clubCustom.map), ...patch } })) fail();
  }
  function dropImage(club: { id: string; name: string }) {
    const logo = { ...logoOf(club, clubCustom.map) };
    delete logo.img;
    if (!setClubCustom(club.id, { logo })) fail();
  }
  function resetClub(id: string) {
    resetClubCustom([id]);
  }

  // 업로드 이미지는 64×64로 가운데를 잘라 줄인다 — localStorage 용량(약 5MB)에 200개 클럽이 다 들어가게.
  async function upload(club: { id: string; name: string }, e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 64, 64);
      // WebP 인코딩을 못 하는 브라우저(PNG로 떨어짐)나 한도를 넘으면 JPEG로 다시 줄인다.
      let img = canvas.toDataURL('image/webp', 0.85);
      if (!img.startsWith('data:image/webp') || img.length > CLUB_CUSTOM_IMG_MAX) img = canvas.toDataURL('image/jpeg', 0.8);
      if (img.length > CLUB_CUSTOM_IMG_MAX) return toast('이미지가 너무 복잡해 저장할 수 없어요');
      const others = clubImgTotal(clubCustom.map) - (clubCustom.map[club.id]?.logo?.img?.length ?? 0);
      if (others + img.length > CLUB_CUSTOM_IMG_TOTAL_MAX) return toast('엠블럼 이미지를 더 저장할 공간이 없어요 — 다른 클럽 이미지를 지운 뒤 올려 주세요');
      editLogo(club, { img });
    } catch {
      toast('이미지를 읽지 못했어요');
    }
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([exportClubCustom()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'offside-clubs.json' });
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const n = importClubCustom(await file.text());
    toast(n < 0 ? '에디트 파일 형식이 올바르지 않아요' : `클럽 ${n}개 설정을 불러왔어요`);
  }
  function resetLeague() {
    resetClubCustom(clubsIn(leagueId).map((c) => c.id));
    toast('이 리그를 기본값으로 되돌렸어요');
  }
  function resetAll() {
    if (!confirm('모든 리그의 클럽 이름·엠블럼을 기본값으로 되돌릴까요?')) return;
    resetClubCustom();
    toast('모든 클럽을 기본값으로 되돌렸어요');
  }
</script>

<section class="card settings-card">
  <button class="settings-row settings-trigger" aria-expanded={clubsOpen} aria-controls="settings-clubs" data-settings-open="clubs" onclick={() => (clubsOpen = !clubsOpen)}>
    <span class="settings-label">
      <small class="eyebrow">Team settings</small>
      <strong>구단 이름·엠블럼 변경</strong>
    </span>
    <i class="settings-chev" aria-hidden="true">▼</i>
  </button>
  {#if clubsOpen}
    <div class="stack settings-body" id="settings-clubs" style="gap:10px">
      <p class="muted" style="font-size:13px;margin:0">클럽 이름과 엠블럼을 원하는 대로 바꿀 수 있어요. 바꾼 뒤부터 생기는 오퍼·기록에 새 이름이 쓰입니다.</p>
      <p class="muted" style="font-size:12px;margin:0" data-club-sync={clubCustom.status} aria-live="polite">{SYNC_TEXT[clubCustom.status]}</p>
      <div class="field">
        <label for="club-league">리그</label>
        <select id="club-league" bind:value={leagueId} onchange={() => (open = null)}>
          {#each LEAGUES as L (L.id)}
            <option value={L.id}>{L.name} ({clubsIn(L.id).length}개 클럽)</option>
          {/each}
        </select>
      </div>
      <ul class="club-list">
        {#each clubs as c (c.id)}
          {@const logo = logoOf(c, clubCustom.map)}
          <li class="club-row" data-club={c.id}>
            <div class="club-main">
              <ClubBadge club={c} size={34} />
              <input
                type="text"
                aria-label="{c.baseName} 이름"
                maxlength={CLUB_NAME_MAX}
                placeholder={c.baseName}
                value={clubCustom.map[c.id]?.name ?? ''}
                onchange={(e) => rename(c.id, e.currentTarget.value)}
              />
              <button class="icon-btn" data-act="logo" aria-expanded={open === c.id} onclick={() => (open = open === c.id ? null : c.id)}>엠블럼</button>
            </div>
            {#if open === c.id}
              <div class="club-logo-edit">
                <label>글자 <input type="text" maxlength={LOGO_TEXT_MAX} value={logo.text} onchange={(e) => editLogo(c, { text: e.currentTarget.value })} /></label>
                <label>바탕 <input type="color" value={logo.bg} onchange={(e) => editLogo(c, { bg: e.currentTarget.value })} /></label>
                <label>글자색 <input type="color" value={logo.fg} onchange={(e) => editLogo(c, { fg: e.currentTarget.value })} /></label>
                <label class="icon-btn">이미지 올리기<input type="file" accept="image/*" hidden onchange={(e) => upload(c, e)} /></label>
                {#if logo.img}<button class="icon-btn" onclick={() => dropImage(c)}>이미지 빼기</button>{/if}
                <button class="icon-btn" onclick={() => resetClub(c.id)}>기본값</button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="icon-btn" onclick={resetLeague}>이 리그 초기화</button>
        <button class="icon-btn" data-act="export-clubs" onclick={exportFile}>에디트 파일 내보내기</button>
        <label class="icon-btn">에디트 파일 가져오기<input type="file" accept="application/json,.json" hidden onchange={importFile} /></label>
        <button class="icon-btn" onclick={resetAll}>전체 초기화</button>
      </div>
    </div>
  {/if}
</section>

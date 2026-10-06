<script lang="ts">
  // 설정 화면의 "구단 이름·엠블럼 변경" 카드(T-10-009) — 리그별 클럽 이름·엠블럼 편집, 에디트 파일 내보내기/가져오기.
  import { LEAGUES } from '@offside/game/data';
  import { CLUB_NAME_MAX, LOGO_TEXT_MAX, logoOf, type ClubLogo } from '@offside/game/clubs';
  import { CLUB_CUSTOM_IMG_MAX, CLUB_CUSTOM_IMG_TOTAL_MAX, clubImgTotal } from '@offside/contracts/club-limits';
  import { clubsIn } from '@offside/game/engine';
  import { CLUB_SYNC_TEXT } from '@offside/app-core/clubCustom';
  import { clubCustom, setClubCustom, resetClubCustom, exportClubCustom, importClubCustom } from './clubCustom.svelte.js';
  import { toast } from './helpers.js';
  import { doneOnEnter } from './inputDone.js';
  import ClubBadge from './ClubBadge.svelte';
  import { clubText as T } from '@offside/app-core/i18n/ko/club';

  let clubsOpen = $state(false);
  let leagueId = $state(LEAGUES[LEAGUES.length - 1]!.id);
  let open = $state<string | null>(null);
  // 이름 편집 결과가 다시 CLUBS에서 읽히도록 clubCustom.map을 의존성에 건다.
  const clubs = $derived((void clubCustom.map, clubsIn(leagueId).map((c) => ({ ...c }))));

  const fail = () => toast(T.noSpace);

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
      if (img.length > CLUB_CUSTOM_IMG_MAX) return toast(T.imgComplex);
      const others = clubImgTotal(clubCustom.map) - (clubCustom.map[club.id]?.logo?.img?.length ?? 0);
      if (others + img.length > CLUB_CUSTOM_IMG_TOTAL_MAX) return toast(T.imgFull);
      editLogo(club, { img });
    } catch {
      toast(T.imgReadFail);
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
    toast(n < 0 ? T.badFile : T.imported({ n }));
  }
  function resetLeague() {
    resetClubCustom(clubsIn(leagueId).map((c) => c.id));
    toast(T.leagueReset);
  }
  function resetAll() {
    if (!confirm(T.resetAllConfirm)) return;
    resetClubCustom();
    toast(T.allReset);
  }
</script>

<section class="card settings-card">
  <button class="settings-row settings-trigger" aria-expanded={clubsOpen} aria-controls="settings-clubs" data-settings-open="clubs" onclick={() => (clubsOpen = !clubsOpen)}>
    <span class="settings-label">
      <small class="eyebrow">Team settings</small>
      <strong>{T.title}</strong>
    </span>
    <i class="settings-chev" aria-hidden="true">▼</i>
  </button>
  {#if clubsOpen}
    <div class="stack settings-body" id="settings-clubs" style="gap:10px">
      <p class="muted fs-sm" style="margin:0">{T.intro}</p>
      <p class="muted fs-xs" style="margin:0" data-club-sync={clubCustom.status} aria-live="polite">{CLUB_SYNC_TEXT[clubCustom.status]}</p>
      <div class="field">
        <label for="club-league">{T.league}</label>
        <select id="club-league" bind:value={leagueId} onchange={() => (open = null)}>
          {#each LEAGUES as L (L.id)}
            <option value={L.id}>{T.leagueOption({ name: L.name, n: clubsIn(L.id).length })}</option>
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
                aria-label={T.nameLabel({ name: c.baseName ?? c.name })}
                maxlength={CLUB_NAME_MAX}
                placeholder={c.baseName}
                enterkeyhint="done"
                use:doneOnEnter
                value={clubCustom.map[c.id]?.name ?? ''}
                onchange={(e) => rename(c.id, e.currentTarget.value)}
              />
              <button class="icon-btn" data-act="logo" aria-expanded={open === c.id} onclick={() => (open = open === c.id ? null : c.id)}>{T.emblem}</button>
            </div>
            {#if open === c.id}
              <div class="club-logo-edit">
                <label>{T.logoText} <input type="text" maxlength={LOGO_TEXT_MAX} enterkeyhint="done" use:doneOnEnter value={logo.text} onchange={(e) => editLogo(c, { text: e.currentTarget.value })} /></label>
                <label>{T.bg} <input type="color" value={logo.bg} onchange={(e) => editLogo(c, { bg: e.currentTarget.value })} /></label>
                <label>{T.fg} <input type="color" value={logo.fg} onchange={(e) => editLogo(c, { fg: e.currentTarget.value })} /></label>
                <label class="icon-btn">{T.uploadImage}<input type="file" accept="image/*" hidden onchange={(e) => upload(c, e)} /></label>
                {#if logo.img}<button class="icon-btn" onclick={() => dropImage(c)}>{T.dropImage}</button>{/if}
                <button class="icon-btn" onclick={() => resetClub(c.id)}>{T.reset}</button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="icon-btn" onclick={resetLeague}>{T.resetLeague}</button>
        <button class="icon-btn" data-act="export-clubs" onclick={exportFile}>{T.exportFile}</button>
        <label class="icon-btn">{T.importFile}<input type="file" accept="application/json,.json" hidden onchange={importFile} /></label>
        <button class="icon-btn" onclick={resetAll}>{T.resetAll}</button>
      </div>
    </div>
  {/if}
</section>

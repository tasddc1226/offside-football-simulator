<script lang="ts">
  // 환경설정 화면(T-10-009, T-10-021). 계정(구글 로그인) 카드 아래로 항목마다 카드를 둔다 — 다크 모드·효과음 켜기/끄기,
  // 접히는 "구단 이름·엠블럼 변경"(리그별 클럽 이름·엠블럼, 에디트 파일 내보내기/가져오기), 운영 도구(관리자),
  // 도움말·서비스 정책 링크. 다크 모드·효과음 설정은 이 기기에만 저장된다.
  import { LEAGUES } from '../game/data.js';
  import { CLUB_NAME_MAX, IMG_MAX, LOGO_TEXT_MAX, logoOf, type ClubLogo } from '../game/clubs.js';
  import { clubsIn } from '../game/engine.js';
  import { clubCustom, setClubCustom, resetClubCustom, exportClubCustom, importClubCustom } from './clubCustom.svelte.js';
  import { goHome } from './actions.js';
  import { toast } from './helpers.js';
  import Topbar from './Topbar.svelte';
  import ClubBadge from './ClubBadge.svelte';
  import { setSfxEnabled, sfxEnabled } from './sfx.js';
  import { isDark, setDark } from './theme.js';
  import { showInstallGuide } from './install.js';
  import { fetchBoardViewer } from '../api/boards.js';
  import { appState } from './state.svelte.js';
  import { accountCache } from './account-state.svelte.js';
  import type { Component } from 'svelte';

  let sfx = $state(sfxEnabled());
  let dark = $state(isDark());
  // 계정 패널은 게임 로직과 무관한 로그인 UI라 메인 청크와 분리된 동적 import로 불러온다.
  let Account = $state<Component<Record<string, never>> | null>(null);
  void import('./Account.svelte').then((m) => (Account = m.default));

  // T-10-016: 운영자에게만 운영 도구 입구를 보인다. 관리자는 구글 연결 계정이라, 연결된 계정일 때만
  // 서버에 묻는다(10분 메모 — 익명 사용자는 요청이 나가지 않는다). 계정 패널이 로그인 상태를 불러오거나
  // 바꾸면 다시 판단한다.
  let admin = $state(false);
  $effect(() => {
    const acct = accountCache.value;
    if (acct && acct !== 'error' && acct.linked.google) void fetchBoardViewer().then((r) => (admin = r.ok && r.data.admin));
    else admin = false;
  });

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
      if (!img.startsWith('data:image/webp') || img.length > IMG_MAX) img = canvas.toDataURL('image/jpeg', 0.8);
      if (img.length > IMG_MAX) return toast('이미지가 너무 복잡해 저장할 수 없어요');
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

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>← 홈</button>
    {/snippet}
  </Topbar>
  <header class="settings-head">
    <div class="eyebrow">Settings</div>
    <h1>환경설정</h1>
  </header>

  <section class="card settings-card" id="account-slot" aria-label="계정">
    {#if Account}
      <Account />
    {/if}
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Display</small>
        <strong id="dark-label">다크 모드</strong>
        <span class="muted">어두운 화면으로 봐요. 이 기기에 저장됩니다.</span>
      </div>
      <button class="switch" role="switch" aria-checked={dark} aria-labelledby="dark-label" data-setting="dark" onclick={() => setDark((dark = !dark))}></button>
    </div>
  </section>

  <section class="card settings-card">
    <div class="settings-row">
      <div class="settings-label">
        <small class="eyebrow">Sound</small>
        <strong id="sfx-label">효과음</strong>
        <span class="muted">버튼을 누를 때 클릭 소리를 내요.</span>
      </div>
      <button class="switch" role="switch" aria-checked={sfx} aria-labelledby="sfx-label" data-setting="sfx" onclick={() => setSfxEnabled((sfx = !sfx))}></button>
    </div>
  </section>

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

  {#if admin}
    <section class="card settings-card">
      <button class="settings-row settings-trigger" data-act="admin" onclick={() => (appState.screen = 'admin')}>
        <span class="settings-label">
          <small class="eyebrow">Admin</small>
          <strong>운영 도구</strong>
        </span>
        <i class="settings-chev" aria-hidden="true">›</i>
      </button>
    </section>
  {/if}

  <section class="settings-group" aria-labelledby="settings-help">
    <div class="eyebrow">Help</div>
    <h2 id="settings-help">도움말</h2>
    <nav class="card settings-links" aria-label="도움말">
      <button data-act="install-guide" onclick={() => showInstallGuide()}>홈 화면에 추가하기 <span aria-hidden="true">›</span></button>
      <a href="/guide/">게임 가이드 <span aria-hidden="true">›</span></a>
      <a href="/faq/">자주 묻는 질문 <span aria-hidden="true">›</span></a>
    </nav>
  </section>

  <section class="settings-group" aria-labelledby="settings-legal">
    <div class="eyebrow">Legal</div>
    <h2 id="settings-legal">서비스 정책</h2>
    <nav class="card settings-links" aria-label="서비스 정책">
      <a href="/legal/terms/">이용약관 <span aria-hidden="true">›</span></a>
      <a href="/legal/privacy/">개인정보 처리방침 <span aria-hidden="true">›</span></a>
    </nav>
  </section>

  <footer class="settings-foot">
    <p>문의 <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p>
    <p>Instagram <a href="https://www.instagram.com/offside.lab.kr/" target="_blank" rel="noopener noreferrer">@offside.lab.kr</a></p>
  </footer>
</div>

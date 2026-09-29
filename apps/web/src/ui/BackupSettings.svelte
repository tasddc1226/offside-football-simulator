<script lang="ts">
  // 설정 화면의 "진행 중 커리어 백업" 카드(T-10-116) — 세이브를 백업 코드/파일로 내보내고 다시 불러온다.
  // 세이브는 이 브라우저에만 있어서, 기기를 바꾸거나 카톡 등 앱 안 브라우저에서 사파리로 옮길 때 쓴다.
  // 형식·검증·쓰는 키는 backup.ts. 여기는 화면과 브라우저 API(클립보드·공유·파일)만 맡는다.
  import { loadHOF } from '@offside/game/season';
  import { loadGame } from './boot.js';
  import { applyBackup, backupFileName, decodeBackup, encodeBackup, type DecodeFail } from './backup.js';
  import { save, toast } from './helpers.js';
  import { goHome } from './nav.js';
  import { appState } from './state.svelte.js';

  // 클립보드를 못 쓰는 브라우저에서 사용자가 직접 복사하도록 코드를 보여 주는 칸.
  let manualCode = $state('');
  let pasted = $state('');
  let fileInput = $state<HTMLInputElement>();

  const FAIL_TEXT: Record<DecodeFail, string> = {
    empty: '백업 코드를 붙여넣거나 백업 파일을 골라 주세요',
    format: '백업 코드가 올바르지 않아요. 코드를 끝까지 복사했는지 확인해 주세요',
    version: '이 백업은 지금 게임과 형식이 맞지 않아 불러올 수 없어요',
    saveVersion: '이 백업은 지금 게임 버전과 맞지 않아 불러올 수 없어요',
    save: '백업 안의 커리어 데이터가 올바르지 않아 불러올 수 없어요',
    tooLarge: '백업 코드가 너무 커서 불러올 수 없어요',
  };

  /** 지금 진행 중인 세이브로 백업 JSON·코드를 만든다(못 만들면 null). */
  function build() {
    if (!appState.G) return null;
    save(); // 화면 상태를 저장소에 맞춰 둔다(RNG 상태 포함)
    let raw: unknown;
    try {
      raw = JSON.parse(localStorage.getItem('ft_save') ?? 'null');
    } catch {
      raw = null;
    }
    // 저장소가 막혀 있어도 메모리의 세이브로 백업은 만들 수 있다.
    const g = raw ?? JSON.parse(JSON.stringify(appState.G));
    return encodeBackup(g, loadHOF());
  }

  async function copyCode() {
    const b = build();
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.code);
      manualCode = '';
      toast('백업 코드를 복사했어요');
    } catch {
      manualCode = b.code; // 자동 복사 실패 — 칸을 열어 직접 복사하게 한다.
      queueMicrotask(() => {
        const el = document.getElementById('backup-code') as HTMLTextAreaElement | null;
        el?.focus();
        el?.select();
      });
      toast('아래 코드를 길게 눌러 직접 복사해 주세요');
    }
  }

  async function saveFile() {
    const b = build();
    if (!b) return;
    const name = backupFileName();
    const file = new File([b.json], name, { type: 'application/json' });
    // 모바일은 공유 시트(파일 앱·카톡 나에게 보내기 등)가 가장 편하다.
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'OFFSIDE 커리어 백업' });
        return;
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return; // 사용자가 공유 시트를 닫음
      // 그 밖의 실패는 아래 다운로드로 넘어간다.
    }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('백업 파일을 저장했어요');
  }

  function importText(text: string) {
    const r = decodeBackup(text);
    if (!r.ok) return toast(FAIL_TEXT[r.reason]);
    const cur = appState.G;
    if (cur && !cur.retired) {
      if (!confirm(`지금 진행 중인 ${cur.name} 선수의 커리어를 백업으로 바꿀까요? 되돌릴 수 없어요.`)) return;
    }
    if (!applyBackup(r.backup, loadHOF())) return toast('저장 공간이 부족해 백업을 불러오지 못했어요. 현재 커리어는 그대로예요');
    loadGame(); // 부팅과 같은 길로 저장을 읽는다(형식 변환·RNG 복원·밸런스)
    appState.report = null;
    pasted = '';
    manualCode = '';
    goHome();
    toast('백업을 불러왔어요');
  }

  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 12_000_000) return toast(FAIL_TEXT.tooLarge);
    try {
      importText(await file.text());
    } catch {
      toast('파일을 읽지 못했어요');
    }
  }
</script>

<section class="card settings-card" data-settings="backup">
  <div class="settings-label">
    <small class="eyebrow">Backup</small>
    <strong>진행 중 커리어 백업</strong>
    <span class="muted">기기를 바꾸거나 카톡 등 앱 안 브라우저에서 옮길 때 쓰세요. 백업 코드는 다른 사람에게 보내지 마세요.</span>
  </div>
  {#if appState.G}
    <div class="backup-actions" data-backup="export">
      <button class="btn btn-sm" data-act="backup-copy" onclick={copyCode}>코드 복사</button>
      <button class="btn btn-sm" data-act="backup-file" onclick={saveFile}>파일로 저장</button>
    </div>
    {#if manualCode}
      <div class="field">
        <label for="backup-code">백업 코드 (직접 복사)</label>
        <textarea id="backup-code" readonly rows="3" data-backup="code" value={manualCode} onfocus={(e) => e.currentTarget.select()}></textarea>
      </div>
    {/if}
  {/if}
  <div class="backup-import" data-backup="import">
    <div class="field">
      <label for="backup-paste">백업 불러오기</label>
      <textarea id="backup-paste" rows="3" placeholder="백업 코드를 여기에 붙여넣어요" autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={pasted}></textarea>
    </div>
    <div class="backup-actions">
      <button class="btn btn-sm" data-act="backup-import" disabled={!pasted.trim()} onclick={() => importText(pasted)}>불러오기</button>
      <button class="btn btn-sm" data-act="backup-pick" onclick={() => fileInput?.click()}>파일에서 불러오기</button>
      <input bind:this={fileInput} type="file" accept=".json,application/json,text/plain" hidden data-backup="file" onchange={importFile} />
    </div>
  </div>
</section>

<style>
  .backup-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .backup-import {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .backup-import .backup-actions {
    margin-top: 10px;
  }
  textarea {
    /* 긴 코드가 한 줄로 흘러 가로로 넘치지 않게 */
    word-break: break-all;
    font-family: ui-monospace, monospace;
    font-size: max(0.875rem, 16px);
  }
  .field {
    margin-top: 12px;
  }
</style>

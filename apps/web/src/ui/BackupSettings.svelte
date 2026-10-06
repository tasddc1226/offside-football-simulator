<script lang="ts">
  // 설정 화면의 "진행 중 커리어 백업" 카드(T-10-116) — 세이브를 백업 코드/파일로 내보내고 다시 불러온다.
  // 세이브는 이 브라우저에만 있어서, 기기를 바꾸거나 카톡 등 앱 안 브라우저에서 사파리로 옮길 때 쓴다.
  // 형식·검증·쓰는 키는 backup.ts. 여기는 화면과 브라우저 API(클립보드·공유·파일)만 맡는다.
  import { loadHOF, loadKey } from '@offside/game/hof-store';
  import { loadGame } from './boot.js';
  import { applyBackup, backupFileName, decodeBackup, encodeBackup, type DecodeFail } from '@offside/app-core/backup';
  import { save, toast } from './helpers.js';
  import { goHome } from './nav.js';
  import { appState } from './state.svelte.js';
  import { backupText as L } from '@offside/app-core/i18n/ko/backup';

  // 클립보드를 못 쓰는 브라우저에서 사용자가 직접 복사하도록 코드를 보여 주는 칸.
  let manualCode = $state('');
  let pasted = $state('');
  let fileInput = $state<HTMLInputElement>();

  const failText = (): Record<DecodeFail, string> => ({
    empty: L.failEmptyWeb,
    format: L.failFormat,
    version: L.failVersion,
    saveVersion: L.failSaveVersion,
    save: L.failSave,
    tooLarge: L.failTooLarge,
  });

  /** 지금 진행 중인 세이브로 백업 JSON·코드를 만든다(못 만들면 null). */
  function build() {
    if (!appState.G) return null;
    save(); // 화면 상태를 저장소에 맞춰 둔다(RNG 상태 포함)
    // 저장소가 막혀 있어도 메모리의 세이브로 백업은 만들 수 있다.
    const g = loadKey('ft_save') ?? JSON.parse(JSON.stringify(appState.G));
    return encodeBackup(g, loadHOF());
  }

  async function copyCode() {
    const b = build();
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.code);
      manualCode = '';
      toast(L.copied);
    } catch {
      manualCode = b.code; // 자동 복사 실패 — 칸을 열어 직접 복사하게 한다.
      queueMicrotask(() => {
        const el = document.getElementById('backup-code') as HTMLTextAreaElement | null;
        el?.focus();
        el?.select();
      });
      toast(L.copyManual);
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
        await navigator.share({ files: [file], title: L.shareTitle });
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
    toast(L.fileSaved);
  }

  function importText(text: string) {
    const r = decodeBackup(text);
    if (!r.ok) return toast(failText()[r.reason]);
    const cur = appState.G;
    if (cur && !cur.retired) {
      if (!confirm(L.replaceConfirm({ name: cur.name }))) return;
    }
    if (!applyBackup(r.backup, loadHOF())) return toast(L.noSpace);
    loadGame(); // 부팅과 같은 길로 저장을 읽는다(형식 변환·RNG 복원·밸런스)
    appState.report = null;
    pasted = '';
    manualCode = '';
    goHome();
    toast(L.restored);
  }

  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 12_000_000) return toast(failText().tooLarge);
    try {
      importText(await file.text());
    } catch {
      toast(L.fileReadFail);
    }
  }
</script>

<section class="card settings-card" data-settings="backup">
  <div class="settings-label">
    <small class="eyebrow">Backup</small>
    <strong>{L.title}</strong>
    <span class="muted">{L.bodyWeb}</span>
  </div>
  {#if appState.G}
    <div class="backup-actions" data-backup="export">
      <button class="btn btn-sm" data-act="backup-copy" onclick={copyCode}>{L.copyCode}</button>
      <button class="btn btn-sm" data-act="backup-file" onclick={saveFile}>{L.saveFile}</button>
    </div>
    {#if manualCode}
      <div class="field">
        <label for="backup-code">{L.manualLabel}</label>
        <textarea id="backup-code" readonly rows="3" data-backup="code" value={manualCode} onfocus={(e) => e.currentTarget.select()}></textarea>
      </div>
    {/if}
  {/if}
  <div class="backup-import" data-backup="import">
    <div class="field">
      <label for="backup-paste">{L.importLabel}</label>
      <textarea id="backup-paste" rows="3" placeholder={L.pastePlaceholder} autocomplete="off" autocapitalize="off" spellcheck="false" bind:value={pasted}></textarea>
    </div>
    <div class="backup-actions">
      <button class="btn btn-sm" data-act="backup-import" disabled={!pasted.trim()} onclick={() => importText(pasted)}>{L.importBtn}</button>
      <button class="btn btn-sm" data-act="backup-pick" onclick={() => fileInput?.click()}>{L.pickFile}</button>
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

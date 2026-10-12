import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sendSlack, slackMessage } from './slack-ops-client.mjs';

export function storeMail(entry, enabledAt) {
  if (!Number.isFinite(Date.parse(enabledAt))) throw new Error('Invalid activation time');
  if (!/^[a-f0-9]{12,40}$/.test(entry.id ?? '') || !['apple', 'google'].includes(entry.store))
    throw new Error('Invalid store mail');
  if (
    !Number.isFinite(Date.parse(entry.receivedAt)) ||
    Date.parse(entry.receivedAt) < Date.parse(enabledAt)
  )
    return null;
  const from = String(entry.from ?? '').toLowerCase();
  if (
    entry.authenticated !== true ||
    !(entry.store === 'apple' ? /@(?:email\.)?apple\.com$/.test(from) : /@google\.com$/.test(from))
  )
    throw new Error('Unverified store sender');
  if (!/offside|오프사이드|6817463687|com\.offsidelab\.app/i.test(entry.appEvidence ?? ''))
    throw new Error('Unrelated app');
  if (
    !/review|심사|승인|거절|reject|approv|available|ready for sale|게시|publishing|출시/i.test(
      entry.subject ?? '',
    )
  )
    return null;
  if (/receipt|order|영수증|주문|test:|purchase/i.test(entry.subject)) return null;
  const source = `https://mail.google.com/mail/u/0/#all/${entry.id}`;
  return slackMessage(
    `📱 ${entry.store === 'apple' ? 'App Store' : 'Google Play'} 심사·출시 메일`,
    [
      String(entry.subject).slice(0, 240),
      `수신: ${new Date(entry.receivedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })} (한국 시간)`,
      '스토어가 보낸 상태 변경 메일입니다. 현재 최종 상태는 콘솔에서 확인하세요.',
    ],
    [
      { label: '원본 메일', url: source },
      {
        label: '스토어 콘솔',
        url:
          entry.store === 'apple'
            ? 'https://appstoreconnect.apple.com/apps/6817463687/distribution/info'
            : 'https://play.google.com/console/u/0/developers/5332532079298277259/app/4975992462923037880/test-and-release',
      },
    ],
  );
}
export async function processStoreMail(entries, configDir, fetcher = fetch) {
  if (!Array.isArray(entries) || entries.length > 100) throw new Error('Invalid mail batch');
  const statePath = join(configDir, 'store-mail-state.json');
  const hooks = JSON.parse(await readFile(join(configDir, 'hooks.json'), 'utf8'));
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const seen = new Set(state.seen ?? []);
  let sent = 0;
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    const message = storeMail(entry, state.enabledAt);
    if (message) {
      await sendSlack(hooks['offside-releases'], message, fetcher);
      sent++;
    }
    seen.add(entry.id);
    await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
    await writeFile(
      `${statePath}.tmp`,
      JSON.stringify({
        ...state,
        seen: [...seen].slice(-2000),
        checkedAt: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
    await rename(`${statePath}.tmp`, statePath);
  }
  return { sent };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, configDir] = process.argv.slice(2);
  if (!input || !configDir)
    throw new Error('Supply local mail batch file and private configuration directory');
  console.log(await processStoreMail(JSON.parse(await readFile(input, 'utf8')), configDir));
}

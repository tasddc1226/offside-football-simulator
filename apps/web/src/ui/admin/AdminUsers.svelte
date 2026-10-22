<script lang="ts">
  // T-11-263 유저 한 명 조회와 아이템 지급·회수. 프로필 id · 닉네임 · 친구 코드로 찾아 프로필 · 접속 · 커리어 · 구단 · 컵 · 결제 ·
  // 아이템 · 지급 기록을 한 화면에 모은다. 근거는 api `db/repos/adminUsers.ts`.
  import * as api from '@offside/app-core/api/admin';
  import type { AdminUser } from '@offside/app-core/api/admin';
  import type { OwnerItem } from '@offside/contracts/cup';
  import {
    ADMIN_GRANT_MAX, GRANT_HELP, GRANT_ITEMS, ITEM_NAME, USER_QUERY_HINT, careerLine, cupLine, deviceLine, fundsPurchaseLine,
    grantConfirm, grantError, grantLine, nick, purchaseLine, sessionLine, teamLine, userSummary,
  } from '@offside/app-core/admin/users';
  import { toast } from '../helpers.js';

  let q = $state('');
  let user = $state<AdminUser | null>(null);
  let msg = $state('');
  let busy = $state(false);
  let item = $state<OwnerItem>('reroll');
  let delta = $state(1);
  let reason = $state('');
  let notify = $state(true);

  async function find(query = q) {
    const v = query.trim();
    if (!v) return;
    q = v;
    msg = '';
    busy = true;
    const r = await api.fetchAdminUser(v);
    busy = false;
    user = r.ok ? r.data : null;
    if (!r.ok) msg = r.error.message || '유저를 찾지 못했어요.';
  }
  async function grant() {
    if (!user) return;
    const err = grantError(delta, reason);
    if (err) return toast(err);
    if (!confirm(grantConfirm(user, item, delta))) return;
    busy = true;
    const r = await api.grantAdminItem(user.profile.id, { item, delta, reason: reason.trim(), notify: delta > 0 && notify });
    busy = false;
    if (!r.ok) return toast(r.error.message);
    toast(`${ITEM_NAME[item]} ${r.data.qty}장이 됐어요.`);
    reason = '';
    await find(user.profile.id);
  }
</script>

{#snippet list(title: string, lines: string[], key: string)}
  <section class="stack" style="gap:4px" data-user-section={key}>
    <h3 class="fs-sm" style="margin:0">{title}</h3>
    <ul class="lines">
      {#each lines as line, i (i)}<li>{line}</li>{:else}<li class="muted">없어요.</li>{/each}
    </ul>
  </section>
{/snippet}

<div class="stack" style="gap:14px" data-admin="users">
  <h2 style="margin:0">유저 조회</h2>
  <form class="row" style="gap:8px" onsubmit={(e) => (e.preventDefault(), void find())}>
    <input class="input" style="flex:1" placeholder={USER_QUERY_HINT} bind:value={q} data-user-query />
    <button class="btn btn-sm" type="submit" disabled={busy} data-act="find-user">찾기</button>
  </form>
  {#if msg}<p class="muted fs-sm" style="margin:0">{msg}</p>{/if}
  {#if user}
    {@const u = user}
    <div class="card-in stack" style="gap:12px" data-user={u.profile.id}>
      <div>
        <b>{nick(u.profile.nickname)}</b>
        {#if u.profile.deletedAt}<span class="bad fs-xs"> 삭제된 프로필</span>{/if}
        <small class="muted id">{u.profile.id}</small>
      </div>
      <dl class="sums">
        {#each userSummary(u) as [label, v] (label)}<dt>{label}</dt><dd>{v}</dd>{/each}
      </dl>

      {#if !u.profile.deletedAt}
        <section class="stack grant" style="gap:8px" data-user-grant>
          <h3 class="fs-sm" style="margin:0">아이템 지급·회수</h3>
          <div class="row" style="gap:8px; flex-wrap:wrap">
            <select aria-label="아이템" bind:value={item} data-grant-item>
              {#each GRANT_ITEMS as it (it)}<option value={it}>{ITEM_NAME[it]} (보유 {u.items[it] ?? 0})</option>{/each}
            </select>
            <input class="input num" type="number" min={-ADMIN_GRANT_MAX} max={ADMIN_GRANT_MAX} step="1" aria-label="장수(회수는 −)" bind:value={delta} data-grant-delta />
          </div>
          <input class="input" placeholder="사유(운영 기록에 남아요)" maxlength="200" bind:value={reason} data-grant-reason />
          <label class="fs-sm row" style="gap:6px"><input type="checkbox" bind:checked={notify} disabled={delta < 0} /> 지급 알림 보내기</label>
          <button class="btn btn-sm self-start" disabled={busy} onclick={grant} data-act="grant-item">{delta < 0 ? '회수하기' : '지급하기'}</button>
          <p class="muted fs-xs" style="margin:0">{GRANT_HELP}</p>
        </section>
      {/if}

      {@render list('접속', [...u.sessions.map(sessionLine), ...u.devices.map((d) => `푸시 기기 · ${deviceLine(d)}`)], 'sessions')}
      {@render list('앱 결제', u.purchases.map(purchaseLine), 'purchases')}
      {@render list('운영 지급·회수', u.grants.map(grantLine), 'grants')}
      {@render list('구단 자금으로 산 것', u.fundsPurchases.map(fundsPurchaseLine), 'funds')}
      {@render list('구단', u.teams.map(teamLine), 'teams')}
      {@render list('오프사이드 컵', u.cups.map(cupLine), 'cups')}
      {@render list('최근 커리어', u.careers.recent.map(careerLine), 'careers')}
    </div>
  {/if}
</div>

<style>
  .card-in { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 10px 12px; }
  .id { display: block; word-break: break-all; }
  .sums { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: var(--fs-label); }
  .sums dd { margin: 0; text-align: right; }
  .lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .lines li { padding: 6px 0; border-top: 1px solid var(--line); font-size: var(--fs-label); }
  .grant { border-top: 1px solid var(--line); padding-top: 10px; }
  .num { width: 96px; }
  .bad { color: var(--bad); }
</style>

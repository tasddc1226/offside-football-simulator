<script lang="ts">
  // T-10-016 밸런스 설정. 초안을 만들어 수치를 고치고, 활성화하면 GET /v1/balance로 퍼진다 — 진행 중인
  // 커리어는 다음 시즌 시작부터, 새 커리어는 바로 적용된다. 되돌리기는 옛 버전을 다시 활성화한다.
  import { onMount } from 'svelte';
  import {
    BALANCE_GROUPS,
    BALANCE_KEYS,
    BALANCE_NOTE_MAX,
    BALANCE_SPEC,
    CHOICE_BONUS_RANGE,
    clampTo,
    EVENT_ID_PATTERN,
    EVENT_WEIGHT_RANGE,
    resolveBalance,
    sanitizeBalance,
    type BalanceGroup,
    type BalanceKey,
    type BalanceOverrides,
  } from '@offside/contracts/balance';
  import * as api from '../../api/admin.js';
  import type { BalanceVersion } from '../../api/admin.js';
  import { EVENTS } from '../../game/events-data.js';
  import { toast } from '../helpers.js';
  import { kstDateTime } from '../boardText.js';
  import { eulReul, withRo } from '../format.js';

  /** 'v2를', 'v3을'처럼 버전 번호에 맞는 목적격 조사를 붙인다. */
  const vEul = (n: number) => `v${n}${eulReul(`v${n}`)}`;

  const STATUS = { draft: ['초안', 'warn'], active: ['적용 중', 'good'], archived: ['보관', ''] } as const;
  const GROUPS = Object.entries(BALANCE_GROUPS) as [BalanceGroup, string][];
  const keysOf = (g: BalanceGroup) => BALANCE_KEYS.filter((k) => BALANCE_SPEC[k].group === g);

  const EVENT_LIST = EVENTS.filter((e) => EVENT_ID_PATTERN.test(e.id)).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  // 확률 선택지가 있는 이벤트만 선택지 보정 대상이다.
  const PROB_EVENTS = EVENT_LIST.filter((e) => e.choices.some((c) => c.p));
  const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));
  const eventTitle = (id: string) => EVENT_BY_ID.get(id)?.title ?? id;
  const labelOf = (label: unknown, i: number) => (typeof label === 'string' ? label : `선택지 ${i + 1}`);
  const choiceLabel = (key: string) => {
    const [id, i] = key.split(':') as [string, string];
    return `${eventTitle(id)} — ${labelOf(EVENT_BY_ID.get(id)?.choices[+i]?.label, +i)}`;
  };
  const discardOk = () => !dirty || confirm('저장하지 않은 변경을 버릴까요?');

  let versions = $state<BalanceVersion[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let selected = $state<number | null>(null);
  let work = $state<{ note: string; values: BalanceOverrides }>({ note: '', values: {} });
  let dirty = $state(false);
  let busy = $state(false);
  let addEvent = $state('');
  let addChoiceEvent = $state('');
  let addChoiceIdx = $state('');

  const active = $derived(versions.find((v) => v.status === 'active') ?? null);
  const current = $derived(versions.find((v) => v.version === selected) ?? null);
  const editable = $derived(current?.status === 'draft');
  const activeValues = $derived(resolveBalance(active?.values));
  const probChoices = $derived(
    (EVENT_BY_ID.get(addChoiceEvent)?.choices ?? []).flatMap((c, i) => (c.p ? [{ i, label: labelOf(c.label, i) }] : [])),
  );

  onMount(() => void load());

  async function load(select?: number) {
    const r = await api.fetchBalanceVersions();
    if (!r.ok) {
      status = 'error';
      return;
    }
    versions = r.data.versions;
    status = 'ready';
    pick(select ?? selected ?? versions.find((v) => v.status === 'draft')?.version ?? active?.version ?? null);
  }

  function pick(version: number | null) {
    if (version !== selected && !discardOk()) return;
    selected = version;
    const v = versions.find((x) => x.version === version);
    work = { note: v?.note ?? '', values: $state.snapshot(v?.values) ?? {} };
    dirty = false;
  }

  /** 기본값과 다른 값만 남긴다(서버에도 그렇게 저장된다). */
  function setKnob(k: BalanceKey, raw: string) {
    const spec = BALANCE_SPEC[k];
    const n = Number(raw);
    const next = { ...work.values };
    if (raw.trim() === '' || !Number.isFinite(n)) delete next[k];
    else {
      const v = clampTo(Math.round(n / spec.step) * spec.step, spec.min, spec.max);
      const fixed = +v.toFixed(6);
      if (fixed === spec.def) delete next[k];
      else next[k] = fixed;
    }
    work.values = next;
    dirty = true;
  }
  function setMap(map: 'eventWeight' | 'choiceBonus', key: string, value: number | null) {
    const m = { ...(work.values[map] ?? {}) };
    if (value === null) delete m[key];
    else m[key] = value;
    const next = { ...work.values };
    if (Object.keys(m).length) next[map] = m;
    else delete next[map];
    work.values = next;
    dirty = true;
  }
  const clampRange = (raw: string, r: { min: number; max: number }) => clampTo(Number(raw) || 0, r.min, r.max);

  /** 적용 중인 버전과 비교한 변경 목록. */
  function diffLines(values: BalanceOverrides): string[] {
    const a = activeValues;
    const b = resolveBalance(values);
    const out = BALANCE_KEYS.filter((k) => a[k] !== b[k]).map((k) => `${BALANCE_SPEC[k].label}: ${a[k]} → ${b[k]}`);
    for (const map of ['eventWeight', 'choiceBonus'] as const) {
      const keys = new Set([...Object.keys(a[map]), ...Object.keys(b[map])]);
      const base = map === 'eventWeight' ? 1 : 0;
      for (const k of keys) {
        const [x, y] = [a[map][k] ?? base, b[map][k] ?? base];
        if (x !== y) out.push(`${map === 'eventWeight' ? `등장 가중치 · ${eventTitle(k)}` : `확률 보정 · ${choiceLabel(k)}`}: ${x} → ${y}`);
      }
    }
    return out;
  }
  const changes = $derived(diffLines(work.values));

  async function run<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>): Promise<T | null> {
    busy = true;
    const r = await p;
    busy = false;
    if (!r.ok) {
      toast(r.error.message);
      return null;
    }
    return r.data;
  }

  async function newDraft(from: BalanceOverrides, note: string) {
    if (!discardOk()) return;
    const v = await run(api.createBalanceDraft({ note, values: sanitizeBalance($state.snapshot(from)) }));
    if (!v) return;
    dirty = false;
    toast(`초안 ${vEul(v.version)} 만들었어요`);
    await load(v.version);
  }
  async function save(): Promise<boolean> {
    if (!current || !editable) return false;
    const v = await run(api.updateBalanceDraft(current.version, { note: work.note, values: $state.snapshot(work.values) }));
    if (!v) return false;
    dirty = false;
    versions = versions.map((x) => (x.version === v.version ? v : x));
    return true;
  }
  async function activate(v: BalanceVersion) {
    if (v.status === 'draft' && dirty && !(await save())) return;
    const lines = diffLines(v.status === 'draft' ? work.values : v.values);
    const what = v.status === 'archived' ? `${withRo(`v${v.version}`)} 되돌릴까요?` : `${vEul(v.version)} 적용할까요?`;
    const body = lines.length ? lines.join('\n') : '적용 중인 버전과 값이 같습니다.';
    if (!confirm(`${what}\n\n${body}\n\n진행 중인 커리어는 다음 시즌부터, 새 커리어는 바로 적용됩니다.`)) return;
    if (!(await run(api.activateBalance(v.version)))) return;
    toast(`${vEul(v.version)} 적용했어요`);
    await load(v.version);
  }
  async function remove(v: BalanceVersion) {
    if (!confirm(`초안 ${vEul(v.version)} 지울까요?`)) return;
    if ((await run(api.deleteBalanceDraft(v.version))) === null) return;
    dirty = false;
    selected = null;
    await load();
  }
  const dateOf = (iso: string | null) => (iso ? kstDateTime(iso) : '');
</script>

<div class="stack" style="gap:14px" data-admin="balance">
  <div class="stack" style="gap:4px">
    <h2 style="margin:0">밸런스 설정</h2>
    <p class="muted" style="margin:0;font-size:13px">
      {#if active}적용 중: <b>v{active.version}</b> · {dateOf(active.activatedAt)}{:else}적용 중: <b>기본값</b> (서버 설정 없음){/if}
      — 진행 중인 커리어는 다음 시즌부터, 새 커리어는 바로 적용됩니다.
    </p>
  </div>

  {#if status === 'loading'}
    <p class="muted" aria-live="polite">불러오는 중…</p>
  {:else if status === 'error'}
    <div class="stack" style="gap:8px">
      <p class="muted" style="margin:0">밸런스 설정을 불러오지 못했어요.</p>
      <button class="icon-btn" style="align-self:flex-start" onclick={() => load()}>다시 시도</button>
    </div>
  {:else}
    <div class="row" style="gap:8px">
      <button class="btn btn-accent" data-act="new-draft" disabled={busy} onclick={() => newDraft(active?.values ?? {}, '')}>
        {active ? `v${active.version}에서 새 초안` : '새 초안'}
      </button>
    </div>

    <ul class="admin-versions" aria-label="버전 목록">
      {#each versions as v (v.version)}
        <li>
          <button class="admin-version" aria-current={v.version === selected} data-version={v.version} onclick={() => pick(v.version)}>
            <span class="row" style="gap:6px">
              <b>v{v.version}</b>
              <span class="pill {STATUS[v.status][1]}">{STATUS[v.status][0]}</span>
              <span class="admin-note">{v.note || '메모 없음'}</span>
            </span>
            <span class="muted" style="font-size:12px">{dateOf(v.activatedAt ?? v.updatedAt)}</span>
          </button>
        </li>
      {:else}
        <li class="muted">아직 만든 버전이 없어요. 지금은 코드 기본값으로 돌아갑니다.</li>
      {/each}
    </ul>

    {#if current}
      <section class="stack admin-editor" style="gap:14px" aria-label="v{current.version} 설정" data-editing={current.version}>
        <div class="row" style="gap:8px;justify-content:space-between">
          <h3 style="margin:0">v{current.version} <span class="pill {STATUS[current.status][1]}">{STATUS[current.status][0]}</span></h3>
          {#if !editable}<span class="muted" style="font-size:12px">초안만 고칠 수 있어요 — 복제해 새 초안을 만드세요.</span>{/if}
        </div>
        <div class="field">
          <label for="bal-note">메모</label>
          <input id="bal-note" type="text" maxlength={BALANCE_NOTE_MAX} disabled={!editable} bind:value={work.note} oninput={() => (dirty = true)} placeholder="무엇을 왜 바꾸는지" />
        </div>

        {#each GROUPS as [g, name] (g)}
          <fieldset class="admin-group" disabled={!editable}>
            <legend>{name}</legend>
            {#each keysOf(g) as k (k)}
              {@const spec = BALANCE_SPEC[k]}
              {@const val = work.values[k] ?? spec.def}
              <div class="admin-knob" class:changed={val !== activeValues[k]} data-knob={k}>
                <div class="stack" style="gap:2px;min-width:0">
                  <label for="knob-{k}"><b>{spec.label}</b></label>
                  <span class="muted" style="font-size:12px">{spec.desc}</span>
                  <span class="muted" style="font-size:12px">기본 {spec.def} · 적용 중 {activeValues[k]} · 범위 {spec.min}~{spec.max}</span>
                </div>
                <div class="row" style="gap:6px;flex-wrap:nowrap">
                  <input id="knob-{k}" type="number" min={spec.min} max={spec.max} step={spec.step} value={val} onchange={(e) => setKnob(k, e.currentTarget.value)} />
                  {#if editable && work.values[k] !== undefined}
                    <button class="icon-btn" aria-label="{spec.label} 기본값으로" onclick={() => setKnob(k, '')}>기본값</button>
                  {/if}
                </div>
              </div>
            {/each}
          </fieldset>
        {/each}

        <fieldset class="admin-group" disabled={!editable}>
          <legend>이벤트 등장 가중치</legend>
          <p class="muted" style="margin:0;font-size:12px">이벤트별 등장 빈도 배율(기본 1, 0이면 나오지 않음, 범위 {EVENT_WEIGHT_RANGE.min}~{EVENT_WEIGHT_RANGE.max}).</p>
          {#each Object.entries(work.values.eventWeight ?? {}) as [id, w] (id)}
            <div class="admin-knob" data-event-weight={id}>
              <label for="ew-{id}">{eventTitle(id)} <span class="muted">({id})</span></label>
              <div class="row" style="gap:6px;flex-wrap:nowrap">
                <input id="ew-{id}" type="number" min={EVENT_WEIGHT_RANGE.min} max={EVENT_WEIGHT_RANGE.max} step="0.1" value={w} onchange={(e) => setMap('eventWeight', id, clampRange(e.currentTarget.value, EVENT_WEIGHT_RANGE))} />
                {#if editable}<button class="icon-btn" aria-label="{eventTitle(id)} 가중치 빼기" onclick={() => setMap('eventWeight', id, null)}>빼기</button>{/if}
              </div>
            </div>
          {/each}
          {#if editable}
            <div class="row" style="gap:6px;flex-wrap:nowrap">
              <select aria-label="가중치를 바꿀 이벤트" bind:value={addEvent}>
                <option value="">이벤트 고르기…</option>
                {#each EVENT_LIST.filter((e) => work.values.eventWeight?.[e.id] === undefined) as e (e.id)}<option value={e.id}>{e.title} ({e.id})</option>{/each}
              </select>
              <button class="icon-btn" disabled={!addEvent} onclick={() => (setMap('eventWeight', addEvent, 1), (addEvent = ''))}>추가</button>
            </div>
          {/if}
        </fieldset>

        <fieldset class="admin-group" disabled={!editable}>
          <legend>선택지 성공 확률 보정</legend>
          <p class="muted" style="margin:0;font-size:12px">선택지의 성공 확률에 더하는 값(범위 {CHOICE_BONUS_RANGE.min}~{CHOICE_BONUS_RANGE.max}, 결과는 1~99%).</p>
          {#each Object.entries(work.values.choiceBonus ?? {}) as [key, b] (key)}
            <div class="admin-knob" data-choice-bonus={key}>
              <label for="cb-{key}">{choiceLabel(key)}</label>
              <div class="row" style="gap:6px;flex-wrap:nowrap">
                <input id="cb-{key}" type="number" min={CHOICE_BONUS_RANGE.min} max={CHOICE_BONUS_RANGE.max} step="0.01" value={b} onchange={(e) => setMap('choiceBonus', key, clampRange(e.currentTarget.value, CHOICE_BONUS_RANGE))} />
                {#if editable}<button class="icon-btn" aria-label="{choiceLabel(key)} 보정 빼기" onclick={() => setMap('choiceBonus', key, null)}>빼기</button>{/if}
              </div>
            </div>
          {/each}
          {#if editable}
            <div class="stack" style="gap:6px">
              <select aria-label="보정할 이벤트" bind:value={addChoiceEvent} onchange={() => (addChoiceIdx = '')}>
                <option value="">이벤트 고르기…</option>
                {#each PROB_EVENTS as e (e.id)}<option value={e.id}>{e.title} ({e.id})</option>{/each}
              </select>
              <div class="row" style="gap:6px;flex-wrap:nowrap">
                <select aria-label="보정할 선택지" bind:value={addChoiceIdx} disabled={!addChoiceEvent}>
                  <option value="">선택지 고르기…</option>
                  {#each probChoices as c (c.i)}<option value={String(c.i)}>{c.label}</option>{/each}
                </select>
                <button
                  class="icon-btn"
                  disabled={!addChoiceEvent || addChoiceIdx === ''}
                  onclick={() => (setMap('choiceBonus', `${addChoiceEvent}:${addChoiceIdx}`, 0), (addChoiceIdx = ''))}>추가</button>
              </div>
            </div>
          {/if}
        </fieldset>

        <div class="stack admin-diff" style="gap:4px" aria-live="polite">
          <b style="font-size:13px">적용 중인 버전과 다른 값 {changes.length}개</b>
          {#each changes as line, i (i)}<span style="font-size:12px">{line}</span>{/each}
        </div>

        <div class="row" style="gap:8px">
          {#if editable}
            <button class="btn btn-primary" data-act="save-draft" disabled={busy || !dirty} onclick={() => void save().then((ok) => ok && toast('저장했어요'))}>저장</button>
            <button class="btn btn-accent" data-act="activate" disabled={busy} onclick={() => activate(current)}>적용하기</button>
            <button class="icon-btn" data-act="delete-draft" disabled={busy} onclick={() => remove(current)}>초안 삭제</button>
          {:else}
            <button class="icon-btn" data-act="duplicate" disabled={busy} onclick={() => newDraft(current.values, `v${current.version} 복제`)}>복제해 새 초안</button>
            {#if current.status === 'archived'}
              <button class="btn btn-accent" data-act="rollback" disabled={busy} onclick={() => activate(current)}>이 버전으로 되돌리기</button>
            {/if}
          {/if}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .admin-versions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; max-height: 260px; overflow-y: auto; border: 1px solid var(--line); border-radius: 12px; }
  .admin-version { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: none; border: 0; border-bottom: 1px solid var(--line); text-align: left; color: inherit; font: inherit; cursor: pointer; min-height: 44px; }
  .admin-versions li:last-child .admin-version { border-bottom: 0; }
  .admin-version[aria-current='true'] { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
  .admin-note { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; font-size: 13px; }
  .admin-group { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin: 0; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .admin-group legend { font-weight: 700; padding: 0 4px; }
  .admin-knob { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 4px 6px; border-radius: 8px; }
  .admin-knob.changed { background: color-mix(in srgb, var(--warn) 12%, transparent); }
  .admin-knob input[type='number'] { width: 96px; }
  .icon-btn { white-space: nowrap; flex: none; }
  .admin-diff { border-top: 1px dashed var(--line); padding-top: 10px; }
  @media (max-width: 420px) { .admin-knob { grid-template-columns: 1fr; } }
</style>

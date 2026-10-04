// T-10-016 밸런스 설정(웹 admin/AdminBalance.svelte). 초안을 만들어 수치를 고치고, 활성화하면 GET /v1/balance로 퍼진다 — 진행 중인
// 커리어는 다음 시즌 시작부터, 새 커리어는 바로 적용된다. 되돌리기는 옛 버전을 다시 활성화한다.
// 값 고치기·차이 계산은 웹과 같은 app-core/balanceEdit를 쓴다. <select>는 PickerField(목록 창)로 바꿨다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import {
  BALANCE_GROUPS,
  BALANCE_KEYS,
  BALANCE_NOTE_MAX,
  BALANCE_SPEC,
  CHOICE_BONUS_RANGE,
  clampTo,
  EVENT_WEIGHT_RANGE,
  resolveBalance,
  sanitizeBalance,
  type BalanceGroup,
  type BalanceKey,
  type BalanceOverrides,
} from '@offside/contracts/balance';
import * as api from '@offside/app-core/api/admin';
import type { BalanceVersion } from '@offside/app-core/api/admin';
import {
  EVENT_LIST,
  PROB_EVENTS,
  choiceLabel,
  diffLines as diffOf,
  eventTitle,
  probChoicesOf,
  setKnobValue,
  setMapValue,
} from '@offside/app-core/balanceEdit';
import { kstDateTime } from '@offside/app-core/boardText';
import { withEulReul, withRo } from '@offside/app-core/format';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { toast } from '../../../game/host';
import { alpha } from '../../../theme/colors';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Pill } from '../../../ui/bits';
import { Press } from '../../../ui/Press';
import { Txt } from '../../../ui/Txt';
import { Field, TextBox, confirmAsync } from '../../board/parts';
import { NumberBox, PickerField } from './balanceParts';

const STATUS = {
  draft: ['초안', 'warn'],
  active: ['적용 중', 'good'],
  archived: ['보관', undefined],
} as const;
const GROUPS = Object.entries(BALANCE_GROUPS) as [BalanceGroup, string][];
const keysOf = (g: BalanceGroup) => BALANCE_KEYS.filter((k) => BALANCE_SPEC[k].group === g);
const clampRange = (raw: string, r: { min: number; max: number }) =>
  clampTo(Number(raw) || 0, r.min, r.max);
const dateOf = (iso: string | null) => (iso ? kstDateTime(iso) : '');
const evOptions = (list: readonly { id: string; title: string }[]) =>
  list.map((e) => ({ value: e.id, label: `${e.title} (${e.id})` }));

type Work = { note: string; values: BalanceOverrides };

/** 묶음(웹 <fieldset>) — 테두리 상자 + 제목. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View
      accessibilityLabel={title}
      style={{
        gap: 10,
        minWidth: 0,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 12,
      }}
    >
      <Txt bold>{title}</Txt>
      {children}
    </View>
  );
}

export default function AdminBalance() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const narrow = width <= 420;
  const [versions, setVersions] = useState<BalanceVersion[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [selected, setSelected] = useState<number | null>(null);
  const [work, setWork] = useState<Work>({ note: '', values: {} });
  const [dirty, setDirtyState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addEvent, setAddEvent] = useState('');
  const [addChoiceEvent, setAddChoiceEvent] = useState('');
  const [addChoiceIdx, setAddChoiceIdx] = useState('');
  // 비동기 흐름(저장 뒤 다시 불러오기 등)이 방금 바꾼 값을 바로 읽도록 ref를 함께 둔다.
  const dirtyRef = useRef(false);
  const selectedRef = useRef<number | null>(null);
  const setDirty = (v: boolean) => {
    dirtyRef.current = v;
    setDirtyState(v);
  };

  const active = versions.find((v) => v.status === 'active') ?? null;
  const current = versions.find((v) => v.version === selected) ?? null;
  const editable = current?.status === 'draft';
  const activeValues = resolveBalance(active?.values);
  const probChoices = probChoicesOf(addChoiceEvent);
  const changes = diffOf(active?.values, work.values);
  const diffLines = (values: BalanceOverrides) => diffOf(active?.values, values);

  const discardOk = async () =>
    !dirtyRef.current || confirmAsync('저장하지 않은 변경을 버릴까요?', undefined, '버리기');

  async function pick(version: number | null, list: BalanceVersion[]) {
    if (version !== selectedRef.current && !(await discardOk())) return;
    selectedRef.current = version;
    setSelected(version);
    const v = list.find((x) => x.version === version);
    setWork({ note: v?.note ?? '', values: v?.values ?? {} });
    setDirty(false);
  }

  const load = useCallback(async (select?: number) => {
    const r = await api.fetchBalanceVersions();
    if (!r.ok) {
      setStatus('error');
      return;
    }
    const list = r.data.versions;
    setVersions(list);
    setStatus('ready');
    await pick(
      select ??
        selectedRef.current ??
        list.find((v) => v.status === 'draft')?.version ??
        list.find((v) => v.status === 'active')?.version ??
        null,
      list,
    );
  }, []);
  useEffect(() => void load(), [load]);

  /** 기본값과 다른 값만 남긴다(서버에도 그렇게 저장된다). */
  function setKnob(k: BalanceKey, raw: string) {
    setWork((w) => ({ ...w, values: setKnobValue(w.values, k, raw) }));
    setDirty(true);
  }
  function setMap(map: 'eventWeight' | 'choiceBonus', key: string, value: number | null) {
    setWork((w) => ({ ...w, values: setMapValue(w.values, map, key, value) }));
    setDirty(true);
  }

  async function run<T>(
    p: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>,
  ): Promise<T | null> {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) {
      toast(r.error.message);
      return null;
    }
    return r.data;
  }

  async function newDraft(from: BalanceOverrides, note: string) {
    if (!(await discardOk())) return;
    const v = await run(api.createBalanceDraft({ note, values: sanitizeBalance(from) }));
    if (!v) return;
    setDirty(false);
    toast(`초안 ${withEulReul(`v${v.version}`)} 만들었어요`);
    await load(v.version);
  }
  async function save(): Promise<boolean> {
    if (!current || !editable) return false;
    const v = await run(
      api.updateBalanceDraft(current.version, { note: work.note, values: work.values }),
    );
    if (!v) return false;
    setDirty(false);
    setVersions((list) => list.map((x) => (x.version === v.version ? v : x)));
    return true;
  }
  async function activate(v: BalanceVersion) {
    if (v.status === 'draft' && dirty && !(await save())) return;
    const lines = diffLines(v.status === 'draft' ? work.values : v.values);
    const what =
      v.status === 'archived'
        ? `${withRo(`v${v.version}`)} 되돌릴까요?`
        : `${withEulReul(`v${v.version}`)} 적용할까요?`;
    const body = lines.length ? lines.join('\n') : '적용 중인 버전과 값이 같습니다.';
    if (
      !(await confirmAsync(
        what,
        `${body}\n\n진행 중인 커리어는 다음 시즌부터, 새 커리어는 바로 적용됩니다.`,
        v.status === 'archived' ? '되돌리기' : '적용',
      ))
    )
      return;
    if (!(await run(api.activateBalance(v.version)))) return;
    toast(`${withEulReul(`v${v.version}`)} 적용했어요`);
    await load(v.version);
  }
  async function remove(v: BalanceVersion) {
    if (!(await confirmAsync(`초안 ${withEulReul(`v${v.version}`)} 지울까요?`, undefined, '삭제')))
      return;
    if ((await run(api.deleteBalanceDraft(v.version))) === null) return;
    setDirty(false);
    selectedRef.current = null;
    setSelected(null);
    await load();
  }

  const small = { fontSize: rem(0.75) } as const;
  /** 이름·설명 칸 + 오른쪽 입력 칸(웹 .admin-knob: 좁은 화면에선 세로로 쌓는다). */
  const knob = (key: string, changed: boolean, left: React.ReactNode, right: React.ReactNode) => (
    <View
      key={key}
      testID={key}
      style={{
        flexDirection: narrow ? 'column' : 'row',
        alignItems: narrow ? 'stretch' : 'center',
        gap: 8,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 8,
        backgroundColor: changed ? alpha(c.warn, 0.12) : 'transparent',
      }}
    >
      <View style={{ flex: narrow ? undefined : 1, gap: 2, minWidth: 0 }}>{left}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{right}</View>
    </View>
  );

  return (
    <View testID="admin-balance" style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Txt v="h2" accessibilityRole="header">
          밸런스 설정
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          {active ? (
            <>
              {'적용 중: '}
              <Txt bold tone="muted" style={{ fontSize: rem(0.8125) }}>{`v${active.version}`}</Txt>
              {` · ${dateOf(active.activatedAt)}`}
            </>
          ) : (
            <>
              {'적용 중: '}
              <Txt bold tone="muted" style={{ fontSize: rem(0.8125) }}>
                기본값
              </Txt>
              {' (서버 설정 없음)'}
            </>
          )}
          {' — 진행 중인 커리어는 다음 시즌부터, 새 커리어는 바로 적용됩니다.'}
        </Txt>
      </View>

      <LoadState
        status={status}
        failText="밸런스 설정을 불러오지 못했어요."
        retry={() => void load()}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn
            kind="accent"
            testID="new-draft"
            disabled={busy}
            onPress={() => void newDraft(active?.values ?? {}, '')}
          >
            {active ? `v${active.version}에서 새 초안` : '새 초안'}
          </Btn>
        </View>

        <ScrollView
          nestedScrollEnabled
          accessibilityLabel="버전 목록"
          style={{ maxHeight: 260, borderWidth: 1, borderColor: c.line, borderRadius: 12 }}
        >
          {versions.length ? (
            versions.map((v, i) => (
              <Press
                key={v.version}
                scale={0.99}
                testID={`version-${v.version}`}
                accessibilityState={{ selected: v.version === selected }}
                onPress={() => void pick(v.version, versions)}
                style={{
                  minHeight: 44,
                  gap: 2,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: i === versions.length - 1 ? 0 : 1,
                  borderBottomColor: c.line,
                  backgroundColor: v.version === selected ? alpha(c.accent, 0.12) : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt bold>{`v${v.version}`}</Txt>
                  <Pill tone={STATUS[v.status][1]}>{STATUS[v.status][0]}</Pill>
                  <Txt numberOfLines={1} style={{ flex: 1, fontSize: rem(0.8125) }}>
                    {v.note || '메모 없음'}
                  </Txt>
                </View>
                <Txt tone="muted" style={small}>
                  {dateOf(v.activatedAt ?? v.updatedAt)}
                </Txt>
              </Press>
            ))
          ) : (
            <Txt tone="muted" style={{ padding: 12 }}>
              아직 만든 버전이 없어요. 지금은 코드 기본값으로 돌아갑니다.
            </Txt>
          )}
        </ScrollView>

        {current ? (
          <View
            testID={`editing-${current.version}`}
            accessibilityLabel={`v${current.version} 설정`}
            style={{ gap: 14 }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt v="h3" accessibilityRole="header">{`v${current.version}`}</Txt>
                <Pill tone={STATUS[current.status][1]}>{STATUS[current.status][0]}</Pill>
              </View>
              {!editable ? (
                <Txt tone="muted" style={[small, { flex: 1, textAlign: 'right' }]}>
                  초안만 고칠 수 있어요 — 복제해 새 초안을 만드세요.
                </Txt>
              ) : null}
            </View>
            <Field label="메모">
              <TextBox
                testID="bal-note"
                maxLength={BALANCE_NOTE_MAX}
                editable={editable}
                placeholder="무엇을 왜 바꾸는지"
                returnKeyType="done"
                value={work.note}
                onChangeText={(note) => {
                  setWork((w) => ({ ...w, note }));
                  setDirty(true);
                }}
                style={{ opacity: editable ? 1 : 0.6 }}
              />
            </Field>

            {GROUPS.map(([g, name]) => (
              <Group key={g} title={name}>
                {keysOf(g).map((k) => {
                  const spec = BALANCE_SPEC[k];
                  const val = work.values[k] ?? spec.def;
                  return knob(
                    `knob-${k}`,
                    val !== activeValues[k],
                    <>
                      <Txt bold>{spec.label}</Txt>
                      <Txt tone="muted" style={small}>
                        {spec.desc}
                      </Txt>
                      <Txt tone="muted" style={small}>
                        {`기본 ${spec.def} · 적용 중 ${activeValues[k]} · 범위 ${spec.min}~${spec.max}`}
                      </Txt>
                    </>,
                    <>
                      <NumberBox
                        testID={`knob-input-${k}`}
                        accessibilityLabel={spec.label}
                        editable={!!editable}
                        negative={spec.min < 0}
                        value={val}
                        onCommit={(raw) => setKnob(k, raw)}
                      />
                      {editable && work.values[k] !== undefined ? (
                        <Btn
                          sm
                          accessibilityLabel={`${spec.label} 기본값으로`}
                          onPress={() => setKnob(k, '')}
                        >
                          기본값
                        </Btn>
                      ) : null}
                    </>,
                  );
                })}
              </Group>
            ))}

            <Group title="이벤트 등장 가중치">
              <Txt tone="muted" style={small}>
                {`이벤트별 등장 빈도 배율(기본 1, 0이면 나오지 않음, 범위 ${EVENT_WEIGHT_RANGE.min}~${EVENT_WEIGHT_RANGE.max}).`}
              </Txt>
              {Object.entries(work.values.eventWeight ?? {}).map(([id, w]) =>
                knob(
                  `event-weight-${id}`,
                  false,
                  <Txt>
                    {eventTitle(id)}
                    <Txt tone="muted">{` (${id})`}</Txt>
                  </Txt>,
                  <>
                    <NumberBox
                      accessibilityLabel={`${eventTitle(id)} 가중치`}
                      editable={!!editable}
                      value={w}
                      onCommit={(raw) =>
                        setMap('eventWeight', id, clampRange(raw, EVENT_WEIGHT_RANGE))
                      }
                    />
                    {editable ? (
                      <Btn
                        sm
                        accessibilityLabel={`${eventTitle(id)} 가중치 빼기`}
                        onPress={() => setMap('eventWeight', id, null)}
                      >
                        빼기
                      </Btn>
                    ) : null}
                  </>,
                ),
              )}
              {editable ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <PickerField
                    accessibilityLabel="가중치를 바꿀 이벤트"
                    placeholder="이벤트 고르기…"
                    options={evOptions(
                      EVENT_LIST.filter((e) => work.values.eventWeight?.[e.id] === undefined),
                    )}
                    value={addEvent}
                    onChange={setAddEvent}
                  />
                  <Btn
                    sm
                    disabled={!addEvent}
                    onPress={() => {
                      setMap('eventWeight', addEvent, 1);
                      setAddEvent('');
                    }}
                  >
                    추가
                  </Btn>
                </View>
              ) : null}
            </Group>

            <Group title="선택지 성공 확률 보정">
              <Txt tone="muted" style={small}>
                {`선택지의 성공 확률에 더하는 값(범위 ${CHOICE_BONUS_RANGE.min}~${CHOICE_BONUS_RANGE.max}, 결과는 1~99%).`}
              </Txt>
              {Object.entries(work.values.choiceBonus ?? {}).map(([key, b]) =>
                knob(
                  `choice-bonus-${key}`,
                  false,
                  <Txt>{choiceLabel(key)}</Txt>,
                  <>
                    <NumberBox
                      accessibilityLabel={choiceLabel(key)}
                      editable={!!editable}
                      negative
                      value={b}
                      onCommit={(raw) =>
                        setMap('choiceBonus', key, clampRange(raw, CHOICE_BONUS_RANGE))
                      }
                    />
                    {editable ? (
                      <Btn
                        sm
                        accessibilityLabel={`${choiceLabel(key)} 보정 빼기`}
                        onPress={() => setMap('choiceBonus', key, null)}
                      >
                        빼기
                      </Btn>
                    ) : null}
                  </>,
                ),
              )}
              {editable ? (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row' }}>
                    <PickerField
                      accessibilityLabel="보정할 이벤트"
                      placeholder="이벤트 고르기…"
                      options={evOptions(PROB_EVENTS)}
                      value={addChoiceEvent}
                      onChange={(v) => {
                        setAddChoiceEvent(v);
                        setAddChoiceIdx('');
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <PickerField
                      accessibilityLabel="보정할 선택지"
                      placeholder="선택지 고르기…"
                      disabled={!addChoiceEvent}
                      options={probChoices.map((p) => ({ value: String(p.i), label: p.label }))}
                      value={addChoiceIdx}
                      onChange={setAddChoiceIdx}
                    />
                    <Btn
                      sm
                      disabled={!addChoiceEvent || addChoiceIdx === ''}
                      onPress={() => {
                        setMap('choiceBonus', `${addChoiceEvent}:${addChoiceIdx}`, 0);
                        setAddChoiceIdx('');
                      }}
                    >
                      추가
                    </Btn>
                  </View>
                </View>
              ) : null}
            </Group>

            <View
              accessibilityLiveRegion="polite"
              style={{
                gap: 4,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: c.line,
                borderStyle: 'dashed',
              }}
            >
              <Txt
                bold
                style={{ fontSize: rem(0.8125) }}
              >{`적용 중인 버전과 다른 값 ${changes.length}개`}</Txt>
              {changes.map((line, i) => (
                <Txt key={i} style={small}>
                  {line}
                </Txt>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {editable ? (
                <>
                  <Btn
                    kind="primary"
                    testID="save-draft"
                    disabled={busy || !dirty}
                    onPress={() => void save().then((ok) => ok && toast('저장했어요'))}
                  >
                    저장
                  </Btn>
                  <Btn
                    kind="accent"
                    testID="activate"
                    disabled={busy}
                    onPress={() => void activate(current)}
                  >
                    적용하기
                  </Btn>
                  <Btn
                    sm
                    testID="delete-draft"
                    disabled={busy}
                    onPress={() => void remove(current)}
                  >
                    초안 삭제
                  </Btn>
                </>
              ) : (
                <>
                  <Btn
                    sm
                    testID="duplicate"
                    disabled={busy}
                    onPress={() => void newDraft(current.values, `v${current.version} 복제`)}
                  >
                    복제해 새 초안
                  </Btn>
                  {current.status === 'archived' ? (
                    <Btn
                      kind="accent"
                      testID="rollback"
                      disabled={busy}
                      onPress={() => void activate(current)}
                    >
                      이 버전으로 되돌리기
                    </Btn>
                  ) : null}
                </>
              )}
            </View>
          </View>
        ) : null}
      </LoadState>
    </View>
  );
}

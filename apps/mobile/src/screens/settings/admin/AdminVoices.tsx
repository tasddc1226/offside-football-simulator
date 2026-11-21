// T-11-802 운영 도구 '유저 의견' 탭(웹 admin/AdminVoices.svelte). 게임 안 '의견 보내기'로 온 글을 읽고, 다른 언어 글은 번역해
// 보고, 처리 표시를 한다. 목록은 탭을 열 때 · 필터 · 더 보기 · 새로고침 때만 부르고(메모하지 않는다), 처리한 뒤에는 다시 부르지
// 않고 그 행만 바꾸거나 뺀다. 본문은 RN Text로만 그린다. 운영 도구라 한국어만 쓴다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { fetchVoices, type AdminVoice, type AdminVoiceList } from '@offside/app-core/api/admin';
import {
  VOICE_KIND_NAME,
  VOICE_LOAD_FAIL,
  VOICE_NOTE,
  VOICE_TAB,
  applyVoiceResolve,
  resolveVoicesAll,
  voiceConfirmAll,
  voiceEmpty,
  voiceMeta,
  voiceOpenCount,
  voiceProfileShort,
  voiceResolvedToast,
} from '@offside/app-core/admin/voices';
import { VOICE_KINDS, type VoiceKind } from '@offside/contracts/voice';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { toast } from '../../../game/host';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Pill } from '../../../ui/bits';
import { useTranslations } from '../../../ui/Translate';
import { Txt } from '../../../ui/Txt';
import { Seg, TabOpt, confirmAsync } from '../../board/parts';

type Status = 'open' | 'all';
type Filter = { status: Status; kind: VoiceKind | null; profile: string | null };

export default function AdminVoices() {
  const c = useColors();
  const tr = useTranslations();
  const [filter, setFilter] = useState<Filter>({ status: 'open', kind: null, profile: null });
  const [list, setList] = useState<AdminVoiceList | null>(null);
  const [load, setLoad] = useState<LoadStatus>('loading');
  const [busy, setBusy] = useState(false);

  async function fetchList(f: Filter, more = false) {
    if (!more) setLoad('loading');
    const last = more ? list?.items.at(-1) : undefined;
    const r = await fetchVoices({
      status: f.status,
      ...(f.kind ? { kind: f.kind } : {}),
      ...(f.profile ? { profile: f.profile } : {}),
      ...(last ? { before: last.createdAt } : {}),
    });
    if (!r.ok) {
      if (more) toast(r.error.message);
      else setLoad('error');
      return;
    }
    setList(more && list ? { ...r.data, items: [...list.items, ...r.data.items] } : r.data);
    setLoad('ready');
  }
  useEffect(() => void fetchList(filter), []);

  function refilter(next: Partial<Filter>) {
    const f = { ...filter, ...next };
    setFilter(f);
    void fetchList(f);
  }

  async function resolve(ids: string[], resolved: boolean) {
    if (!list || !ids.length) return;
    setBusy(true);
    const r = await resolveVoicesAll(ids, resolved);
    setBusy(false);
    if (!r.ok) {
      toast(r.message);
      // 50개씩 보내다 중간에 멈췄으면 어디까지 바뀌었는지 모르니 목록을 다시 받는다.
      if (r.updated) void fetchList(filter);
      return;
    }
    const at = new Date().toISOString();
    setList((cur) =>
      cur ? applyVoiceResolve(cur, { ids, resolved, updated: r.updated, at }, filter.status) : cur,
    );
    toast(voiceResolvedToast(r.updated, resolved));
  }

  async function resolveAllVisible() {
    const ids = (list?.items ?? []).filter((v) => !v.resolvedAt).map((v) => v.id);
    if (!ids.length) return;
    if (!(await confirmAsync(voiceConfirmAll(ids.length), undefined, '처리'))) return;
    await resolve(ids, true);
  }

  async function copyProfile(v: AdminVoice) {
    await Clipboard.setStringAsync(v.profileId);
    toast('프로필 id를 복사했어요');
  }

  const openVisible = (list?.items ?? []).filter((v) => !v.resolvedAt).length;

  return (
    <View testID="admin-voices" style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Txt v="h2" accessibilityRole="header">
            {VOICE_TAB}
          </Txt>
          {list ? (
            <Txt tone="muted" num testID="voice-open-count">
              {voiceOpenCount(list.open)}
            </Txt>
          ) : null}
        </View>
        <Btn sm testID="voice-refresh" onPress={() => void fetchList(filter)}>
          새로고침
        </Btn>
      </View>
      <Txt v="xs" tone="muted">
        {VOICE_NOTE}
      </Txt>

      <Seg cols={2} label="상태">
        {(['open', 'all'] as const).map((s) => (
          <TabOpt
            key={s}
            tight
            title={s === 'open' ? '열린 것' : '전체'}
            selected={filter.status === s}
            testID={`voice-status-${s}`}
            onPress={() => filter.status !== s && refilter({ status: s })}
          />
        ))}
      </Seg>
      <Seg cols={4} label="종류">
        {[null, ...VOICE_KINDS].map((k) => (
          <TabOpt
            key={k ?? 'all'}
            tight
            title={k ? VOICE_KIND_NAME[k] : '전체'}
            selected={filter.kind === k}
            testID={`voice-filter-${k ?? 'all'}`}
            onPress={() => filter.kind !== k && refilter({ kind: k })}
          />
        ))}
      </Seg>

      {filter.profile ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: RADIUS.sm,
            backgroundColor: c.surface2,
          }}
        >
          <Txt style={{ flex: 1 }}>
            <Txt bold>{voiceProfileShort(filter.profile)}</Txt>
            {' 프로필의 의견만 보는 중'}
          </Txt>
          <Btn sm testID="voice-clear-profile" onPress={() => refilter({ profile: null })}>
            전체 보기
          </Btn>
        </View>
      ) : null}

      <LoadState status={load} failText={VOICE_LOAD_FAIL} retry={() => void fetchList(filter)}>
        {openVisible > 0 ? (
          <Btn
            sm
            testID="voice-resolve-all"
            disabled={busy}
            onPress={() => void resolveAllVisible()}
          >
            {`보이는 열린 의견 모두 처리(${openVisible})`}
          </Btn>
        ) : null}
        <View>
          {list?.items.length ? (
            list.items.map((v) => (
              <View
                key={v.id}
                testID={`admin-voice-${v.id}`}
                style={{
                  gap: 4,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                }}
              >
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
                >
                  <Pill tone={v.kind === 'bug' ? 'warn' : undefined}>
                    {VOICE_KIND_NAME[v.kind as VoiceKind] ?? v.kind}
                  </Pill>
                  {v.resolvedAt ? <Pill tone="good">처리함</Pill> : null}
                </View>
                <Txt selectable>{tr.text(v.id, v.body)}</Txt>
                {tr.button(v.id, v.body)}
                <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                  {voiceMeta(v)}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Btn
                    sm
                    testID="voice-copy-profile"
                    accessibilityLabel={`프로필 id ${voiceProfileShort(v.profileId)} 복사`}
                    onPress={() => void copyProfile(v)}
                  >
                    {voiceProfileShort(v.profileId)}
                  </Btn>
                  {!filter.profile ? (
                    <Btn
                      sm
                      testID="voice-filter-profile"
                      onPress={() => refilter({ profile: v.profileId })}
                    >
                      이 프로필만
                    </Btn>
                  ) : null}
                  <Btn
                    sm
                    testID={v.resolvedAt ? 'voice-reopen' : 'voice-resolve'}
                    disabled={busy}
                    onPress={() => void resolve([v.id], !v.resolvedAt)}
                  >
                    {v.resolvedAt ? '다시 열기' : '처리'}
                  </Btn>
                </View>
              </View>
            ))
          ) : (
            <Txt tone="muted">{voiceEmpty(filter.status)}</Txt>
          )}
        </View>
        {list?.hasMore ? (
          <Btn sm testID="voice-more" onPress={() => void fetchList(filter, true)}>
            더 보기
          </Btn>
        ) : null}
      </LoadState>
    </View>
  );
}

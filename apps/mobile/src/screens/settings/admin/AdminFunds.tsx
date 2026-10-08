// T-11-153 구단 자금 대조(웹 admin/AdminFunds.svelte). 잔액 = 방출 + 판매(수수료 뺀) − 영입 − 구단 자금으로 산 것.
// 기록 밖에서 바뀐 잔액(차이)이 있는 구단주를 보여 주고, 프로필 id나 닉네임으로 한 명의 출처별 합과 최근 움직임을 본다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminFundsOwner, AdminFundsReport } from '@offside/app-core/api/admin';
import { FUNDS_MOVE, fundsItemName, signedFunds } from '@offside/app-core/admin/funds';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { fundsText } from '@offside/app-core/funds';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';
import { TextBox } from '../../board/parts';

export default function AdminFunds() {
  const c = useColors();
  const [report, setReport] = useState<AdminFundsReport | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState<AdminFundsOwner | null>(null);
  const [ownerMsg, setOwnerMsg] = useState('');

  async function load() {
    setStatus('loading');
    const r = await api.fetchFundsReport();
    if (!r.ok) {
      setStatus('error');
      return;
    }
    setReport(r.data);
    setStatus('ready');
  }
  useEffect(() => void load(), []);
  async function find(query = q) {
    const v = query.trim();
    if (!v) return;
    setQ(v);
    setOwnerMsg('');
    const r = await api.fetchFundsOwner(v);
    setOwner(r.ok ? r.data : null);
    if (!r.ok) setOwnerMsg(r.error.message || '구단주를 찾지 못했어요.');
  }

  const small = { fontSize: rem(0.8125) } as const;
  const tiny = { fontSize: rem(0.75) } as const;
  const row = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.line,
  } as const;
  const r = report;
  const sums: [string, number][] = r
    ? [
        ['잔액 합', r.balance],
        ['방출로 들어옴', r.released],
        ['판매(수수료 뺀)', r.sold],
        ['영입', r.bought],
        ['수수료로 없어짐', r.fees],
        ...Object.entries(r.items).map(([item, v]): [string, number] => [fundsItemName(item), v]),
      ]
    : [];
  return (
    <View testID="admin-funds" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          구단 자금 대조
        </Txt>
        <Btn sm testID="refresh-funds" onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      <Txt tone="muted" style={tiny}>
        잔액 = 방출 + 판매(수수료 뺀) − 영입 − 구단 자금으로 산 것(리롤권 · 광고 대신 보상). 차이가
        0이 아니면 기록 밖에서 잔액이 바뀐 구단주예요.
      </Txt>
      <LoadState
        status={status}
        failText="구단 자금 대조를 불러오지 못했어요."
        retry={() => void load()}
      >
        {r ? (
          <>
            <Txt testID="funds-summary" style={small}>
              {`${kst(r.generatedAt)} 기준 · 구단주 ${r.owners.toLocaleString()}명 · 어긋남 ${r.mismatched}명`}
            </Txt>
            <View>
              {sums.map(([label, v]) => (
                <View key={label} style={row}>
                  <Txt style={small}>{label}</Txt>
                  <Txt num style={small}>
                    {fundsText(v)}
                  </Txt>
                </View>
              ))}
            </View>
            {r.mismatches.map((m) => (
              <View key={m.profileId} testID={`funds-mismatch-${m.profileId}`} style={row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={small}>{m.nickname ?? '닉네임 없음'}</Txt>
                  <Txt tone="muted" numberOfLines={1} style={tiny}>
                    {m.profileId}
                  </Txt>
                </View>
                <Btn sm onPress={() => void find(m.profileId)}>
                  {`차이 ${signedFunds(m.diff)}`}
                </Btn>
              </View>
            ))}
          </>
        ) : null}
      </LoadState>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <TextBox
            testID="funds-query"
            value={q}
            onChangeText={setQ}
            placeholder="프로필 id(prf_…) 또는 닉네임"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void find()}
          />
        </View>
        <Btn sm testID="find-funds-owner" onPress={() => void find()}>
          찾기
        </Btn>
      </View>
      {ownerMsg ? (
        <Txt tone="muted" style={small}>
          {ownerMsg}
        </Txt>
      ) : null}
      {owner ? (
        <View
          testID={`funds-owner-${owner.profileId}`}
          style={{
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 12,
          }}
        >
          <Txt bold style={small}>
            {owner.nickname ?? '닉네임 없음'}
          </Txt>
          <Txt tone="muted" style={tiny}>
            {owner.profileId}
          </Txt>
          <Txt style={small}>
            {`잔액 ${fundsText(owner.balance)} = 방출 ${fundsText(owner.released)} + 판매 ${fundsText(owner.sold)} − 영입 ${fundsText(owner.bought)} − 사용 ${fundsText(owner.items)}`}
          </Txt>
          <Txt bold tone={owner.diff === 0 ? 'good' : 'bad'} style={small}>
            {owner.diff === 0 ? '일치' : `차이 ${signedFunds(owner.diff)}`}
          </Txt>
          <View>
            {owner.moves.length ? (
              owner.moves.map((m, i) => (
                <View key={i} style={row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt style={small}>
                      {m.kind === 'item' ? fundsItemName(m.item ?? '') : FUNDS_MOVE[m.kind]}
                    </Txt>
                    <Txt tone="muted" style={tiny}>
                      {kst(m.at)}
                    </Txt>
                  </View>
                  <Txt num bold style={small}>
                    {signedFunds(m.amount)}
                  </Txt>
                </View>
              ))
            ) : (
              <Txt tone="muted" style={small}>
                움직임이 없어요.
              </Txt>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

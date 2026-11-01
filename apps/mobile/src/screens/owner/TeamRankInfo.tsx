// T-11-603 랭크 매칭 첫 화면의 내 팀 정보(웹 team/TeamRankInfo.svelte): 디비전 · RP · 시즌 전적 · 승률 · 오늘 남은 경기(그 아래 action으로
// 매칭 찾기) · 최근 랭크 전적 5경기.
import { FONT } from '@offside/app-core/design-tokens';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { fetchTeamMatches, type OwnerTeam, type TeamMatch } from '@offside/app-core/api/team';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import {
  formStreak,
  recentForm,
  recentRanked,
  winRate,
  type FormPip,
} from '@offside/app-core/rankQueue';
import { divisionHead } from '@offside/app-core/teamDivision';
import { num, recordText } from '@offside/app-core/teamText';
import { DivisionEmblem } from '../../components/DivisionEmblem';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Txt } from '../../ui';
import { MatchRow } from './TeamHistory';

const FORM_N = 5;
const PIP: Record<FormPip, string> = { w: L.statsFormW, d: L.statsFormD, l: L.statsFormL };

export function TeamRankInfo({
  team,
  matchesLeft,
  perDay,
  open,
  action,
}: {
  team: OwnerTeam;
  matchesLeft: number;
  perDay: number;
  /** 최근 전적 한 줄을 누르면 그 경기 결과를 연다. */
  open: (m: TeamMatch) => void;
  /** 내 팀 정보와 최근 전적 사이에 놓는 동작(매칭 찾기가 화면 아래로 밀리지 않게). */
  action?: ReactNode;
}) {
  const c = useColors();
  const head = divisionHead(team);
  const rate = winRate(team.record);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const wanted = useRef(0);
  const load = useCallback(async () => {
    const mine = ++wanted.current;
    setStatus('loading');
    const r = await fetchTeamMatches(team.season);
    if (mine !== wanted.current) return;
    if (!r.ok) return setStatus('error');
    setMatches(r.data.items);
    setStatus('ready');
  }, [team.season]);
  useEffect(() => {
    void load();
    return () => {
      wanted.current += 1;
    };
    // 경기를 치러 전적이 바뀌면 다시 받는다(경기를 치르면 메모도 비워진다).
  }, [load, team.record]);
  const recent = recentRanked(matches, FORM_N);
  const form = recentForm(matches, FORM_N);
  const streak = formStreak(form);
  const tiles = [
    { label: L.infoRecord, value: recordText(team.record) },
    { label: L.infoWinRate, value: rate === null ? '-' : `${rate}%` },
    { label: L.infoLeft, value: `${matchesLeft}/${perDay}` },
  ];
  return (
    <View style={{ gap: 12 }} testID="rank-info">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {head ? <DivisionEmblem division={head.division} size={44} /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {head ? (
            <>
              <Txt bold testID="rank-division">
                {head.name}
              </Txt>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={head.aria}
                accessibilityValue={{ min: 0, max: 100, now: head.pct }}
                style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}
              >
                <View
                  style={{
                    width: `${head.pct}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: head.guard ? c.bad : c.accent,
                  }}
                />
              </View>
              <Txt tone="muted" v="xs">
                {head.line}
              </Txt>
            </>
          ) : null}
        </View>
        <View style={{ alignItems: 'center' }}>
          <Txt
            tone="accent"
            testID="rank-rp"
            style={{
              fontFamily: DISPLAY[700],
              fontSize: rem(FONT.title2),
              lineHeight: rem(FONT.title2) * 1.15,
            }}
          >
            {num(team.rating)}
          </Txt>
          <Txt tone="muted" style={{ fontSize: 11, lineHeight: 13 }}>
            {L.oppRp}
          </Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tiles.map((t) => (
          <View
            key={t.label}
            style={{
              flex: 1,
              minWidth: 0,
              paddingVertical: 8,
              paddingHorizontal: 10,
              gap: 2,
              borderRadius: 10,
              backgroundColor: c.surface2,
            }}
          >
            <Txt tone="muted" style={{ fontSize: 11, lineHeight: 14 }}>
              {t.label}
            </Txt>
            <Txt bold v="sm" style={{ fontVariant: ['tabular-nums'] }}>
              {t.value}
            </Txt>
          </View>
        ))}
      </View>
      {action}
      <View style={{ gap: 8 }} testID="rank-recent">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Txt bold v="sm" accessibilityRole="header">
            {L.statsFormLabel({ n: FORM_N })}
          </Txt>
          {form.length ? (
            <>
              <View
                accessible
                accessibilityRole="image"
                accessibilityLabel={L.statsFormAria({
                  list: form.map((p) => PIP[p]).join(' '),
                })}
                testID={`rank-form-${form.join('')}`}
                style={{ flexDirection: 'row', gap: 4 }}
              >
                {form.map((p, i) => (
                  <View
                    key={i}
                    style={{
                      width: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      backgroundColor: p === 'w' ? c.pitch : p === 'l' ? c.bad : c.line,
                    }}
                  >
                    <Txt
                      bold
                      style={{ fontSize: 11, lineHeight: 13, color: p === 'd' ? c.ink : c.onPitch }}
                    >
                      {PIP[p]}
                    </Txt>
                  </View>
                ))}
              </View>
              {streak ? (
                <Txt bold tone="accent" v="xs" testID="rank-streak">
                  {streak}
                </Txt>
              ) : null}
            </>
          ) : null}
        </View>
        <LoadState status={status} failText={L.historyFail} retry={() => void load()}>
          {recent.length ? (
            recent.map((m) => <MatchRow key={m.id} m={m} open={open} showRp />)
          ) : (
            <Txt tone="muted" v="sm">
              {L.infoNoForm}
            </Txt>
          )}
        </LoadState>
      </View>
    </View>
  );
}

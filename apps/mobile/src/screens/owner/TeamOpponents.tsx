// 상대 고르기(웹 team/Team.svelte 의 view === 'opponents') — 내 팀 OVR과 비슷한 다른 구단주의 팀에 도전한다.
// 경기할 수 없으면(hint) 목록 대신 이유를 보여 준다.
import { View } from 'react-native';
import { TeamLogo } from '../../components/TeamLogo';
import { TEAM_REPEAT_WINDOW_DAYS } from '@offside/contracts/owner-team';
import type { TeamOpponent } from '@offside/app-core/api/team';
import { recordText } from '@offside/app-core/teamText';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Txt } from '../../ui';

export function TeamOpponents({
  ovr,
  matchesLeft,
  perDay,
  opponents,
  status,
  playing,
  reload,
  challenge,
  hint,
  toTeam,
  saveAndFind,
  saving = false,
  canSave = true,
}: {
  ovr: number;
  matchesLeft: number;
  perDay: number;
  opponents: TeamOpponent[];
  status: LoadStatus;
  playing: boolean;
  reload: () => void;
  challenge: (o: TeamOpponent) => void;
  hint: string | null;
  /** 편성 탭으로(지금 시즌이면). */
  toTeam?: (() => void) | undefined;
  saveAndFind?: (() => void) | undefined;
  saving?: boolean;
  canSave?: boolean;
}) {
  const c = useColors();
  return (
    <Card gap={12}>
      <View style={{ gap: 4 }}>
        <Txt v="eyebrow">Match</Txt>
        <Txt v="h1" accessibilityRole="header">
          {L.oppTitle}
        </Txt>
        {hint ? null : (
          <Txt tone="muted" v="sm">
            {L.oppNear({ ovr, left: matchesLeft, per: perDay })}
          </Txt>
        )}
        <Txt tone="muted" v="xs">
          {L.oppRuleApp({ days: TEAM_REPEAT_WINDOW_DAYS })}
        </Txt>
      </View>
      {hint ? (
        <>
          <Txt tone="muted" testID="match-hint">
            {hint}
          </Txt>
          {saveAndFind ? (
            <Btn
              kind="primary"
              disabled={saving || !canSave}
              onPress={saveAndFind}
              testID="team-save-find"
            >
              {saving ? L.saving : L.saveAndFind}
            </Btn>
          ) : null}
          {toTeam ? (
            <Btn sm style={{ alignSelf: 'flex-start' }} onPress={toTeam}>
              {L.toLineup}
            </Btn>
          ) : null}
        </>
      ) : (
        <LoadState status={status} failText={L.oppLoadFail} retry={reload}>
          {opponents.length ? (
            opponents.map((o) => (
              <View
                key={o.teamId}
                testID={`opponent-${o.teamId}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: c.line,
                }}
              >
                <TeamLogo logo={o.logo} name={o.name} size={32} decorative />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt bold>{o.name}</Txt>
                  <Txt
                    tone="muted"
                    v="sm"
                  >{`${o.owner} · ${o.formation} · ${recordText(o.record)}`}</Txt>
                </View>
                <Txt
                  tone="accent"
                  style={{
                    minWidth: rem(1.375) * 1.1,
                    fontFamily: DISPLAY[700],
                    fontSize: rem(1.375),
                    textAlign: 'center',
                  }}
                >
                  {o.ovr}
                </Txt>
                <Btn
                  kind="primary"
                  sm
                  testID="team-challenge"
                  accessibilityLabel={L.challengeAria({ name: o.name })}
                  disabled={playing || matchesLeft === 0}
                  onPress={() => challenge(o)}
                >
                  {L.challenge}
                </Btn>
              </View>
            ))
          ) : (
            <Txt tone="muted">{L.noOpponents}</Txt>
          )}
          <Btn sm style={{ alignSelf: 'flex-start' }} onPress={reload} disabled={playing}>
            {L.moreOpponents}
          </Btn>
        </LoadState>
      )}
    </Card>
  );
}

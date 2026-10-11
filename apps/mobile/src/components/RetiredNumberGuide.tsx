import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { GameState } from '@offside/game/types';
import type { RetiredNumberProgress } from '@offside/contracts';
import { fetchRetiredNumberProgress } from '@offside/app-core/api/retiredNumberProgress';
import { retiredNumberNext } from '@offside/app-core/retiredNumberGuide';
import { gameCareerText } from '@offside/app-core/i18n/ko/gameCareer';
import { tn } from '@offside/game/i18n/names';
import { useColors } from '../theme/useColors';
import { Card } from '../ui/Card';
import { Press } from '../ui/Press';
import { Btn } from '../ui/Btn';
import { Txt } from '../ui/Txt';
import { ClubMark } from '../ui/ClubBadge';

export function RetiredNumberGuide({ s }: { s: GameState }) {
  const c = useColors();
  const L = gameCareerText;
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RetiredNumberProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || !s.career.length) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    void fetchRetiredNumberProgress(s.cid, s.number)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, s.cid, s.number, s.career.length, attempt]);
  return (
    <Card testID="rn-guide">
      <Press
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityLabel={L.rnTitle}
        accessibilityHint={L.rnIntro}
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}
      >
        <View
          accessible={false}
          style={{
            width: 44,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.surface2,
          }}
        >
          <Txt v="h2" num>
            {s.number}
          </Txt>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt bold>{L.rnTitle}</Txt>
          <Txt v="sm" tone="muted">
            {L.rnIntro}
          </Txt>
        </View>
        <Txt v="h2" accessible={false}>
          {open ? '−' : '+'}
        </Txt>
      </Press>
      {open ? (
        <View style={{ gap: 12 }}>
          {!s.career.length ? (
            <Txt v="sm" tone="muted">
              {L.rnEmpty}
            </Txt>
          ) : loading ? (
            <Txt v="sm" tone="muted" accessibilityLiveRegion="polite">
              {L.rnLoading}
            </Txt>
          ) : failed ? (
            <>
              <Txt v="sm" tone="muted" accessibilityLiveRegion="polite">
                {L.rnError}
              </Txt>
              <Btn onPress={() => setAttempt(attempt + 1)}>{L.rnRetry}</Btn>
            </>
          ) : data ? (
            <>
              <Txt v="sm" bold>
                {L.rnScope(data)}
              </Txt>
              <Txt v="sm" tone="muted">
                {L.rnBasis}
              </Txt>
              {data.recordedSeasons < s.career.length ? (
                <Txt v="sm" tone="muted">
                  {L.rnSyncing}
                </Txt>
              ) : null}
              {!data.clubs.length ? (
                <Txt v="sm" tone="muted">
                  {L.rnEmpty}
                </Txt>
              ) : null}
              {data.clubs.map((club) => (
                <View
                  key={club.clubId}
                  style={{ gap: 8, borderTopWidth: 1, borderColor: c.line, paddingTop: 12 }}
                >
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                  >
                    <ClubMark id={club.clubId} name={club.club} />
                    <Txt bold style={{ flexShrink: 1 }}>
                      {tn(club.club)}
                    </Txt>
                    <Txt v="xs" tone={club.availability === 'open' ? 'good' : 'muted'}>
                      {club.availability === 'open'
                        ? L.rnAvailable
                        : club.availability === 'taken'
                          ? L.rnTaken
                          : L.rnUnknown}
                    </Txt>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <Txt v="sm">{L.rnSeasons({ have: club.seasons, need: data.minSeasons })}</Txt>
                    <Txt v="sm" bold>
                      {L.rnProgress({ pct: club.progress })}
                    </Txt>
                  </View>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={L.rnProgress({ pct: club.progress })}
                    accessibilityValue={{ min: 0, max: 100, now: club.progress }}
                    style={{
                      height: 6,
                      borderRadius: 3,
                      overflow: 'hidden',
                      backgroundColor: c.line,
                    }}
                  >
                    <View
                      style={{ height: 6, width: `${club.progress}%`, backgroundColor: c.accent }}
                    />
                  </View>
                  <Txt v="sm">{retiredNumberNext(club, data.minSeasons)}</Txt>
                </View>
              ))}
            </>
          ) : null}
          <Txt v="sm" tone="muted">
            {L.rnRules}
          </Txt>
          <Txt v="xs" tone="muted">
            {L.rnNote}
          </Txt>
        </View>
      ) : null}
    </Card>
  );
}

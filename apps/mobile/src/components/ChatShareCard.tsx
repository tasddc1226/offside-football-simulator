// 라운지에 올린 팀 · 선수 카드(웹 ChatShareCard.svelte). 올린 때의 모습을 그대로 그리고, 눌러야 팀 프로필을 불러온다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { fmtValue } from '@offside/app-core/format';
import { chatText as L } from '@offside/app-core/i18n/ko/chat';
import type { ChatShare } from '@offside/contracts/chat';
import { FORMATION_ROWS } from '@offside/contracts/owner-team';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { PlayerCard } from './PlayerCard';
import { PlayerPeek, type PeekOrigin } from './PlayerPeek';
import { TeamLogo } from './TeamLogo';

type TeamShare = Extract<ChatShare, { kind: 'team' }>;
type PlayerShare = Extract<ChatShare, { kind: 'player' }>;

function TeamCard({
  share,
  label,
  onteam,
}: {
  share: TeamShare;
  label: string;
  onteam: (teamId: string) => void;
}) {
  const c = useColors();
  // 공격이 위로 오도록 뒤 줄부터 그린다.
  let at = 0;
  const rows = FORMATION_ROWS[share.formation]
    .map((n) => share.slots.slice(at, (at += n)))
    .reverse();
  return (
    <Press
      testID="chat-share-team"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onteam(share.teamId)}
      style={{
        width: 280,
        maxWidth: '100%',
        gap: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: RADIUS.md,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TeamLogo logo={share.logo} name={share.name} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt tone="muted" style={{ fontSize: 11, fontWeight: '600' }}>
            {L.shareTeamTag}
          </Txt>
          <Txt bold numberOfLines={1} style={{ fontSize: 15 }}>
            {share.name}
          </Txt>
          <Txt tone="muted" style={{ fontSize: 12 }}>
            {`${share.formation} · ${L.shareRecord(share.record)}`}
          </Txt>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Txt num bold style={{ fontSize: 22, lineHeight: 25 }}>
            {share.ovr}
          </Txt>
          <Txt tone="muted" style={{ fontSize: 10 }}>
            OVR
          </Txt>
        </View>
      </View>
      <View
        accessible={false}
        style={{
          gap: 6,
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderRadius: RADIUS.sm,
          backgroundColor: '#1c4a35',
        }}
      >
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-around', gap: 2 }}>
            {row.map((s, i) => (
              <View key={i} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: s.youth ? '#ffffff33' : '#f2f6f1',
                  }}
                >
                  <Txt num bold style={{ fontSize: 12, color: s.youth ? '#f2f6f1' : '#14201a' }}>
                    {s.rating}
                  </Txt>
                </View>
                <Txt numberOfLines={1} style={{ marginTop: 2, fontSize: 10, color: '#f2f6f1' }}>
                  {s.name}
                </Txt>
              </View>
            ))}
          </View>
        ))}
      </View>
      <Txt tone="accent" style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: '600' }}>
        {`${L.shareOpenTeam} ›`}
      </Txt>
    </Press>
  );
}

function PlayerShareCard({
  share,
  label,
  onteam,
  onlisting,
}: {
  share: PlayerShare;
  label: string;
  onteam: (teamId: string) => void;
  onlisting: (listingId: string) => void;
}) {
  const c = useColors();
  const card = useRef<View>(null);
  const [origin, setOrigin] = useState<PeekOrigin | null>(null);
  const player = share.player as TeamPlayer;
  const { listing, teamId, teamName } = share;
  const link = { fontSize: rem(FONT.caption2), fontWeight: '600' } as const;
  return (
    <View
      testID={listing ? 'chat-share-listing' : 'chat-share-player'}
      style={{
        alignItems: 'center',
        gap: 8,
        maxWidth: 190,
        padding: 10,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: RADIUS.md,
        backgroundColor: c.surface,
      }}
    >
      <Txt tone="muted" style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: '600' }}>
        {listing ? L.shareListingTag : L.sharePlayerTag}
      </Txt>
      {/* 팀 그라운드의 카드와 같은 크기(62×88)로 그리고, 누르면 같은 확대 카드가 뜬다. */}
      <Press
        testID="chat-share-peek"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() =>
          card.current?.measureInWindow((x, y, w, h) => {
            if (w && h) setOrigin({ x, y, w, h });
          })
        }
      >
        <View ref={card} collapsable={false} style={{ width: 62, height: 88 }}>
          <PlayerCard
            cell={{
              name: share.name,
              careerId: player.careerId,
              look: player.look,
              nation: player.nation,
              season: player.season,
              rating: player.peak,
              number: player.number,
              legendScore: player.legendScore,
              specials: player.specials,
              daily: player.daily,
              enhance: player.enhance,
              pos: player.pos,
              youth: false,
            }}
            code={player.dpos ?? player.pos}
            compact
          />
        </View>
      </Press>
      {listing ? (
        <>
          <Txt num bold style={{ fontSize: 14 }}>
            {fmtValue(listing.price)}
          </Txt>
          <Press
            testID="chat-share-open-listing"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onlisting(listing.id)}
          >
            <Txt tone="accent" style={link}>
              {`${L.shareListingOpen} ›`}
            </Txt>
          </Press>
        </>
      ) : teamId && teamName ? (
        <Press
          testID="chat-share-owner"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onteam(teamId)}
        >
          <Txt tone="accent" style={link}>
            {`${L.shareOwnedBy({ team: teamName })} ›`}
          </Txt>
        </Press>
      ) : null}
      {origin ? (
        <PlayerPeek
          player={player}
          name={share.name}
          rating={player.peak}
          origin={origin}
          onclose={() => setOrigin(null)}
        />
      ) : null}
    </View>
  );
}

export function ChatShareCard({
  share,
  label,
  onteam,
  onlisting,
}: {
  share: ChatShare;
  label: string;
  onteam: (teamId: string) => void;
  onlisting: (listingId: string) => void;
}) {
  return share.kind === 'team' ? (
    <TeamCard share={share} label={label} onteam={onteam} />
  ) : (
    <PlayerShareCard share={share} label={label} onteam={onteam} onlisting={onlisting} />
  );
}

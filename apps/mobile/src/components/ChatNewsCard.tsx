// T-11-652 라운지에 올린 리그 경기 기사(웹 ChatNewsCard.svelte). 올린 때의 스코어를 그리고, 누르면 리그 화면을 연다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { leagueNewsText as N } from '@offside/app-core/i18n/ko/leagueNews';
import type { ChatNewsShare } from '@offside/contracts/chat';
import { View } from 'react-native';
import { DISPLAY, rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { TeamLogo } from './TeamLogo';

export function ChatNewsCard({
  news,
  label,
  onopen,
}: {
  news: ChatNewsShare;
  label: string;
  onopen: () => void;
}) {
  const c = useColors();
  const side = (t: ChatNewsShare['home'], away: boolean) => (
    <View style={{ flex: 1, minWidth: 0, gap: 2, alignItems: away ? 'flex-end' : 'flex-start' }}>
      <TeamLogo logo={t.logo} name={t.name} size={28} decorative />
      <Txt v="sm" bold style={{ textAlign: away ? 'right' : 'left' }}>
        {t.name}
      </Txt>
    </View>
  );
  return (
    <Press
      testID={`chat-news-${news.matchId}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onopen}
      style={{
        width: 280,
        maxWidth: '100%',
        gap: 8,
        padding: 10,
        borderWidth: 1,
        borderTopWidth: 3,
        borderColor: c.line,
        borderTopColor: c.ink,
        borderRadius: RADIUS.md,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
        <Txt bold style={{ fontFamily: DISPLAY[700], fontSize: 13 }}>
          {N.chatTag}
        </Txt>
        <Txt tone="muted" style={{ fontSize: 11 }}>
          {N.where({ tier: news.tier, league: news.league, round: news.round })}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {side(news.home, false)}
        <Txt num style={{ fontFamily: DISPLAY[800], fontSize: rem(1.5) }}>
          {`${news.home.goals}:${news.away.goals}`}
        </Txt>
        {side(news.away, true)}
      </View>
      <Txt tone="accent" style={{ fontSize: 12 }}>{`${N.chatOpen} ›`}</Txt>
    </Press>
  );
}

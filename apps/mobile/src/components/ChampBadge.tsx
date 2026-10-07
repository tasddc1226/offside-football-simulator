// T-11-145 '제N회 챔피언' 배지(웹 ui/cup/ChampBadge.svelte) — 팀 프로필 팀 이름 아래와 구단주 탭 닉네임 옆.
// 받침대 없는 작은 금 트로피와 함께.
import { View } from 'react-native';
import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { rem } from '../theme/type';
import { CupTrophy } from '../ui/CupTrophy';
import { Txt } from '../ui/Txt';

const GOLD = EMBLEM_PALETTE.gold;

export function ChampBadge({ edition }: { edition: number }) {
  return (
    <View
      testID="team-champ-badge"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 2,
        paddingLeft: 4,
        paddingRight: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: GOLD.base,
        backgroundColor: `${GOLD.light}4d`,
      }}
    >
      <CupTrophy stage="champion" size={22} />
      <Txt bold style={{ fontSize: rem(0.75) }}>
        {CL.champBadge({ n: edition })}
      </Txt>
    </View>
  );
}

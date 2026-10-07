// T-11-145 컵 기록 카드(웹 cup/CupHonors.svelte) — 우승·준우승·4강은 트로피(금·은·동)와 함께, 그 밖은 기록 한 줄. 팀 프로필 ·
// 구단주 프로필(T-11-150)이 같이 쓴다. 서버가 최근 대회부터 보낸다.
import { View } from 'react-native';
import type { CupHonor } from '@offside/app-core/api/cup';
import { cupTrophy, trophyStage } from '@offside/app-core/cupTrophy';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { stageLabel } from '../screens/owner/cupText';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Card } from '../ui/Card';
import { CupTrophy } from '../ui/CupTrophy';
import { Txt } from '../ui/Txt';

export function CupHonors({ honors }: { honors: readonly CupHonor[] }) {
  const c = useColors();
  if (!honors.length) return null;
  return (
    <Card gap={10} testID="team-cup-honors">
      <View>
        <Txt v="eyebrow">Offside Cup</Txt>
        <Txt v="h2" accessibilityRole="header">
          {CL.honorsTitle}
        </Txt>
      </View>
      <View style={{ gap: 8 }}>
        {honors.map((h) => {
          const trophy = trophyStage(h.stage);
          return (
            <View
              key={`${h.cupId}`}
              testID={`cup-honor-${h.cupId}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: trophy ? 8 : 10,
                paddingHorizontal: trophy ? 10 : 12,
                borderRadius: 12,
                backgroundColor: c.surface2,
                borderWidth: trophy ? 2 : 0,
                borderColor: trophy ? cupTrophy(trophy).palette.base : c.pitchAccent,
              }}
            >
              {trophy ? <CupTrophy stage={trophy} edition={h.edition} size={48} /> : null}
              <View style={{ gap: 2, flexShrink: 1 }}>
                <Txt bold>
                  {h.stage === 'champion'
                    ? CL.champTitle({ n: h.edition })
                    : CL.honorResult({ edition: h.edition, stage: stageLabel(h.stage) })}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.8333) }}>
                  {CL.honorTeam({ team: h.teamName })}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

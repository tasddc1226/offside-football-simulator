import { View } from 'react-native';
import { RADIUS } from '@offside/app-core/design-tokens';
import {
  FORMATION_IDS,
  SHAPE_IDS,
  LINEUP_SIZE,
  matchShape,
  shapeBase,
  shapeLayout,
  type FormationId,
  type TeamPosition,
} from '@offside/contracts/owner-team';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Press, Txt } from '../../ui';
import { ShareIcon } from '../../components/ShareIcon';

type Props = {
  filled: number;
  editable: boolean;
  canAutoFill: boolean;
  season: number;
  formation: FormationId;
  layout: TeamPosition[] | null;
  onAutoFill: () => void;
  onPresets: () => void;
  onShare: () => void;
  onFormation: (formation: FormationId, layout: TeamPosition[] | null) => void;
  retireSyncing: boolean;
  retireRetry: 'idle' | 'busy' | 'failed';
  onRetireRetry: () => void;
};

/** Lineup controls only; draft and sync state remain in the screen. */
export function TeamFormationToolbar({
  filled,
  editable,
  canAutoFill,
  season,
  formation,
  layout,
  onAutoFill,
  onPresets,
  onShare,
  onFormation,
  retireSyncing,
  retireRetry,
  onRetireRetry,
}: Props) {
  const c = useColors();
  return (
    <Card gap={8}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
          <Txt v="h2">{L.groundTitle}</Txt>
          <Txt v="xs" tone="muted">
            {L.startersYouthApp({ n: filled, y: LINEUP_SIZE - filled })}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {editable ? (
            <Btn sm testID="team-auto" disabled={!canAutoFill} onPress={onAutoFill}>
              {L.autoPlace}
            </Btn>
          ) : null}
          {editable ? (
            <Btn sm onPress={onPresets} testID="team-presets">
              {L.tpButton}
            </Btn>
          ) : null}
          <Press
            testID="team-share"
            accessibilityRole="button"
            accessibilityLabel={L.shareImageApp}
            onPress={onShare}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: RADIUS.sm,
              backgroundColor: c.surface2,
            }}
          >
            <ShareIcon color={c.ink} />
          </Press>
        </View>
      </View>
      {editable ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
          accessibilityLabel={L.formationLabelApp}
        >
          {/* T-11-216 시즌 1 배치 프리셋(세부 포지션 자리). 프리시즌 팀은 옛 세 가지만. */}
          {[...FORMATION_IDS, ...(season > 0 ? SHAPE_IDS : [])].map((key) => {
            const on = (layout ? (matchShape(layout) ?? '') : formation) === key;
            return (
              <Press
                key={key}
                testID={`formation-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  const id = SHAPE_IDS.find((s) => s === key);
                  onFormation(
                    id ? shapeBase(id) : (key as FormationId),
                    id ? shapeLayout(id) : null,
                  );
                }}
                style={{
                  flexBasis: season > 0 ? '18%' : '30%',
                  flexGrow: 1,
                  minHeight: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: RADIUS.sm,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? c.accent : c.line,
                }}
              >
                <Txt num bold={on} style={{ fontSize: 12 }}>
                  {key}
                </Txt>
              </Press>
            );
          })}
        </View>
      ) : null}
      {editable && retireSyncing ? (
        <View style={{ gap: 6 }}>
          <Txt v="xs" tone="muted" testID="team-retire-syncing">
            {retireRetry === 'failed' ? L.retireSyncFailed : L.retireSyncing}
          </Txt>
          <Btn
            sm
            testID="team-retire-retry"
            disabled={retireRetry === 'busy'}
            onPress={onRetireRetry}
          >
            {retireRetry === 'busy' ? L.retireSyncRetrying : L.retireSyncRetry}
          </Btn>
        </View>
      ) : null}
    </Card>
  );
}

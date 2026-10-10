import { useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { Screen, Topbar, BackBar, Press, Txt } from '../../ui';
import { go } from '../../game/nav';
import { appState } from '../../store';
import { useColors } from '../../theme/useColors';
import { OwnerHall } from './OwnerHall';
import { OwnerArchive } from './OwnerArchive';

export default function OwnerHonors() {
  const { honorsView, recapNew } = useSnapshot(appState);
  const [visited, setVisited] = useState({
    records: honorsView !== 'titles',
    titles: honorsView === 'titles',
  });
  const c = useColors();
  return (
    <Screen>
      <Topbar />
      <BackBar inline testID="honors-back" fallback={() => go('owner')} />
      <View style={{ gap: 6 }}>
        <Txt v="h1" accessibilityRole="header">
          {L.hallTitle}
        </Txt>
        <Txt tone="muted">{L.archiveLead}</Txt>
      </View>
      <View
        style={{ flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: c.line }}
      >
        {(['records', 'titles'] as const).map((view) => (
          <Press
            key={view}
            testID={`hall-tab-${view}`}
            accessibilityState={{ selected: honorsView === view }}
            onPress={() => {
              appState.honorsView = view;
              setVisited((old) => ({ ...old, [view]: true }));
            }}
            style={{
              minHeight: 48,
              paddingVertical: 12,
              paddingHorizontal: 4,
              borderBottomWidth: 3,
              borderBottomColor: honorsView === view ? c.accent : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Txt bold tone={honorsView === view ? undefined : 'muted'}>
              {view === 'records' ? L.archiveTab : L.titlesTab}
            </Txt>
            {view === 'records' && recapNew ? (
              <View
                accessibilityLabel={L.archiveNew}
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }}
              />
            ) : null}
          </Press>
        ))}
      </View>
      {visited.records ? (
        <View style={{ display: honorsView === 'records' ? 'flex' : 'none' }}>
          <OwnerArchive />
        </View>
      ) : null}
      {visited.titles ? (
        <View style={{ display: honorsView === 'titles' ? 'flex' : 'none' }}>
          <OwnerHall />
        </View>
      ) : null}
    </Screen>
  );
}

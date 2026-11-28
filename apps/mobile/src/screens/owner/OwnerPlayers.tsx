import { useState, type ReactNode } from 'react';
import { Screen, Topbar, BackBar } from '../../ui';
import { FooterSlot } from '../../ui/footerSlot';
import { go } from '../../game/nav';
import { MyPlayers } from './MyPlayers';
export default function OwnerPlayers() {
  // T-11-841 보유 선수를 고르면 방출 합계 줄이 이전으로 바 위에 붙는다.
  const [dock, setDock] = useState<ReactNode>(null);
  return (
    <FooterSlot.Provider value={setDock}>
      <Screen
        footer={
          <>
            {dock}
            <BackBar testID="players-back" fallback={() => go('owner')} />
          </>
        }
      >
        <Topbar />
        <MyPlayers />
      </Screen>
    </FooterSlot.Provider>
  );
}

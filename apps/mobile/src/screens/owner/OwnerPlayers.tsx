import { Screen, Topbar, BackBar } from '../../ui';
import { go } from '../../game/nav';
import { MyPlayers } from './MyPlayers';
export default function OwnerPlayers() {
  return (
    <Screen footer={<BackBar testID="players-back" fallback={() => go('owner')} />}>
      <Topbar />
      <MyPlayers />
    </Screen>
  );
}

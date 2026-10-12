import { Screen, Topbar, BackBar } from '../../ui';
import { go } from '../../game/nav';
import { MemberComparison } from './MemberComparison';
import { MyPlayers } from './MyPlayers';
export default function OwnerPlayers() {
  return (
    <Screen footer={<BackBar testID="players-back" fallback={() => go('owner')} />}>
      <Topbar />
      <MemberComparison />
      <MyPlayers />
    </Screen>
  );
}

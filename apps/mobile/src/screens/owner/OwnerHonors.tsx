import { Screen, Topbar, BackBar } from '../../ui';
import { go } from '../../game/nav';
import { OwnerHall } from './OwnerHall';

export default function OwnerHonors() {
  return (
    <Screen>
      <Topbar />
      <OwnerHall />
      <BackBar testID="honors-back" fallback={() => go('owner')} />
    </Screen>
  );
}

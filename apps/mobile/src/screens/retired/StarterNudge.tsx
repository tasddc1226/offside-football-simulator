// T-11-770d 끝까지 뛴 선수가 은퇴한 화면의 첫 구매 묶음 카드. 로그인한 구단주일 때만 서버에 자격을 묻는다(카드가 스스로 숨는다).
import { useSnapshot } from 'valtio';
import { isMember } from '@offside/app-core/account';
import { accountCache } from '../../store';
import { StarterPackCard } from '../owner/StarterPackCard';

export function StarterNudge() {
  const { value: profile } = useSnapshot(accountCache);
  if (!profile || profile === 'error' || !isMember(profile)) return null;
  return <StarterPackCard place="retired" />;
}

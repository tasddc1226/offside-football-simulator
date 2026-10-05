// 은퇴 화면 '플레이 성향' 카드의 유형 이름·한 줄 평(playStyleReport.ts).
import { ns } from '@offside/contracts/i18n';

const ko = {
  oneclub: '원클럽 순정파',
  oneclubLine: '다른 유니폼은 입어 본 적이 없다. 한 팀에서 끝까지 뛰었다.',
  lucky: '타고난 강운',
  luckyLine: '낮은 확률에 건 선택이 자꾸 들어맞았다. 운도 따라줬다.',
  allin: '올인 승부사',
  allinLine: '확률이 낮을수록 더 걸었다. 안 되면 그만이었다.',
  nomad: '축구계 노마드',
  nomadLine: '짐은 늘 반쯤 싸 두었다. 가는 곳마다 새 등번호.',
  unlucky: '비운의 사나이',
  unluckyLine: '될 만한 선택도 자꾸 빗나갔다. 운이 따라주지 않았다.',
  climber: '사다리 등반가',
  climberLine: '이적할 때마다 리그 수준이 올라갔다. 늘 한 단계 위만 봤다.',
  business: '연봉 협상의 달인',
  businessLine: '축구는 비즈니스. 계약서의 숫자부터 읽었다.',
  loyal: '의리의 사나이',
  loyalLine: '더 큰 구단이 불러도 고개를 저었다.',
  safe: '안전제일주의',
  safeLine: '돌다리도 두들겨 보고 건넜다. 부상 없이 오래가는 게 실력.',
  calculated: '계산된 모험가',
  calculatedLine: '승부는 걸되, 이길 만한 판에만 걸었다.',
  balanced: '균형 잡힌 현실주의자',
  balancedLine: '걸 때와 물러설 때를 가렸다. 큰 기복 없는 커리어.',
};
export type GPlayStyleMsgs = typeof ko;
export const gPlayStyleText = ns('gPlayStyle', ko);

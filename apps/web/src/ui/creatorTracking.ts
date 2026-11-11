// T-11-700 엑솔라 파트너 네트워크(크리에이터 수익 공유). 크리에이터 링크로 들어오면 주소에 tracking_id(32자)가 붙는다.
// 이 값을 이 브라우저에 남겨 두었다가 웹 결제 주문에 실어야 그 결제가 크리에이터 실적으로 잡힌다. 엑솔라 스크립트를
// 불러오지 않고 같은 일을 직접 한다(외부 스크립트를 늘리지 않는다). 값은 링크 식별자일 뿐 사람을 가리키지 않는다.
import { loadKey, saveKey } from '@offside/game/storage';

const KEY = 'ft_creator_tracking';
const FORMAT = /^[A-Za-z0-9]{32}$/;

/** 부팅 때 한 번. 주소에 추적값이 있으면 남긴다(다른 크리에이터 링크로 다시 오면 새 값으로 바뀐다). */
export function detectCreatorTracking(href = location.href) {
  try {
    const id = new URL(href).searchParams.get('tracking_id');
    if (id && FORMAT.test(id)) saveKey(KEY, id);
  } catch {
    /* 주소를 못 읽으면 남기지 않는다. */
  }
}

/** 남겨 둔 추적값. 없거나 형식이 깨졌으면 null(주문에 싣지 않는다). */
export function creatorTrackingId(): string | null {
  const id = loadKey<string>(KEY);
  return typeof id === 'string' && FORMAT.test(id) ? id : null;
}

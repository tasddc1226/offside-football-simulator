// T-11-589 통신판매업 사업자 정보. 공개 저장소라 실명 · 주소를 코드에 두지 않고 운영 설정(BUSINESS_INFO, JSON)을 빌드 때 받는다(vite define).
// 푸터에는 주소 · 전화를 싣지 않는다(사업자 정보 확인 링크로 본다). 이 칸만 번들에 들어가도록 vite 설정이 이 함수로 거른다.
// 이용약관(scripts/seo.mjs)은 같은 설정에서 전체 칸을 읽는다. 값이 없거나 필수 칸이 비면 아무것도 보이지 않는다.
export type BusinessInfo = {
  name: string;
  owner: string;
  regNo: string;
  mailOrderNo: string;
};

const FIELDS = ['name', 'owner', 'regNo', 'mailOrderNo'] as const;

export function parseBusinessInfo(raw: unknown): BusinessInfo | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const out = {} as BusinessInfo;
    for (const k of FIELDS) {
      const s = typeof v[k] === 'string' ? v[k].trim() : '';
      if (!s) return null;
      out[k] = s;
    }
    return out;
  } catch {
    return null;
  }
}

/** 공정위 사업자 정보 공개 조회 주소. */
export const businessCheckUrl = (regNo: string): string =>
  `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${regNo.replace(/\D/g, '')}`;

declare const __BUSINESS_INFO__: string | undefined;
export const businessInfo = parseBusinessInfo(
  typeof __BUSINESS_INFO__ === 'string' ? __BUSINESS_INFO__ : '',
);

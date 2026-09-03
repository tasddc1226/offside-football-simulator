// D-20: 개인정보 처리방침 본문. ADR-002·ADR-008·09 "개인정보와 보존"의 사실만 쓴다. 법률 자문이
// 아닌 초안이다 — 최종 문안·사업자 정보는 U-010(사용자)이 채운다. 화면에는 이 사실을 적지 않는다.
import { OPERATOR, operatorFieldOrPending } from './operator.js';

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

export function PrivacyContent() {
  return (
    <div className="flex flex-col gap-os-5">
      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          수집하는 정보
        </h2>
        <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={BODY_STYLE}>
          <li>익명 프로필 식별자</li>
          <li>설정 값(테마, 텍스트 크기, 모션 감소 등)</li>
          <li>커리어 데이터(선수 정보와 진행 상황)</li>
          <li>복구 코드는 원문이 아니라 해시로만 저장합니다</li>
          <li>Google 계정으로 연결하면 Google 계정 식별자와 이메일</li>
          <li>요청 로그와 요청 식별자</li>
        </ul>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          보관 기간
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          삭제를 요청하면 즉시 삭제합니다. 계정을 병합해 남는 빈 프로필은 30일 뒤 삭제합니다. 요청
          로그의 보관 기간은 운영 문서 기준을 따릅니다.
        </p>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          처리 위탁
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          서버 호스팅과 데이터 저장은 Cloudflare에 위탁합니다. Google 계정으로 로그인하면 Google이
          로그인 처리를 담당합니다.
        </p>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          개인정보의 국외 이전
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          서비스를 이용하는 동안 아래 항목이 네트워크를 통해 국외로 전송되어 해당 국가의 서버에
          저장됩니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-os-border font-os text-os-text-2" style={BODY_STYLE}>
            <caption className="sr-only">개인정보 국외 이전 현황</caption>
            <thead>
              <tr className="bg-os-surface-2 text-os-text">
                <th className="border border-os-border p-os-2 text-left" scope="col">
                  이전받는 자
                </th>
                <th className="border border-os-border p-os-2 text-left" scope="col">
                  국가
                </th>
                <th className="border border-os-border p-os-2 text-left" scope="col">
                  이전 항목
                </th>
                <th className="border border-os-border p-os-2 text-left" scope="col">
                  이전 목적
                </th>
                <th className="border border-os-border p-os-2 text-left" scope="col">
                  보유·이용 기간
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-os-border p-os-2">Cloudflare, Inc.</td>
                <td className="border border-os-border p-os-2">미국 등 해외 리전(Workers·D1·Pages)</td>
                <td className="border border-os-border p-os-2">
                  프로필 식별자·세션·복구 코드 해시·게임 저장 데이터·오류 로그
                </td>
                <td className="border border-os-border p-os-2">서비스 제공과 저장·동기화</td>
                <td className="border border-os-border p-os-2">프로필 삭제 또는 보존 기간 만료 시까지</td>
              </tr>
              <tr>
                <td className="border border-os-border p-os-2">Google LLC</td>
                <td className="border border-os-border p-os-2">미국</td>
                <td className="border border-os-border p-os-2">Google 로그인 시 Google 식별자(sub)·이메일</td>
                <td className="border border-os-border p-os-2">계정 연결·프로필 복구</td>
                <td className="border border-os-border p-os-2">연결 해제 또는 프로필 삭제 시까지</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          이용자 권리
        </h2>
        <ul className="flex flex-col gap-os-1 font-os text-os-text-2" style={BODY_STYLE}>
          <li>복구 코드로 다른 기기에서 프로필을 복구할 수 있습니다</li>
          <li>프로필과 모든 데이터를 삭제할 수 있습니다</li>
          <li>문의: {operatorFieldOrPending(OPERATOR.contactEmail)}</li>
        </ul>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          운영자 정보
        </h2>
        <dl className="flex flex-col gap-os-1 font-os text-os-text-2" style={BODY_STYLE}>
          <div className="flex justify-between gap-os-2">
            <dt>운영자</dt>
            <dd>{operatorFieldOrPending(OPERATOR.name)}</dd>
          </div>
          <div className="flex justify-between gap-os-2">
            <dt>연락처</dt>
            <dd>{operatorFieldOrPending(OPERATOR.contactEmail)}</dd>
          </div>
        </dl>
      </section>

      <p className="font-os text-os-text-2" style={BODY_STYLE}>
        시행일{' '}
        <time dateTime={OPERATOR.effectiveDate}>{operatorFieldOrPending(OPERATOR.effectiveDate)}</time>
      </p>
    </div>
  );
}

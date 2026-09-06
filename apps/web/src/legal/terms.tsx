// D-20: 이용약관 본문. ADR-002·ADR-008·09 "개인정보와 보존"의 사실만 쓴다. 법률 자문이 아닌
// 초안이다 — 최종 문안·사업자 정보는 U-010(사용자)이 채운다. 화면에는 이 사실을 적지 않는다.
import { OPERATOR, operatorFieldOrPending } from './operator.js';

const H2_STYLE = { fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

export function TermsContent() {
  return (
    <div className="flex flex-col gap-os-5">
      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          서비스 정의
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          OFFSIDE는 가상의 축구 선수로 커리어를 진행하는 싱글 플레이어 시뮬레이션 서비스입니다.
        </p>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          가상의 인물과 구단
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          서비스에 등장하는 선수, 감독, 구단은 모두 가상이며 실제 인물이나 단체와 관련이 없습니다.
        </p>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          계정과 복구 코드
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          다른 기기에서는 복구 코드 또는 미리 연결한 Google 계정으로 프로필을 찾을 수 있습니다. 복구
          코드는 본인만 보관해야 하며, 다른 사람에게 노출해 생기는 불이익은 이용자 본인의
          책임입니다.
        </p>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          서비스 변경과 중단
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          서비스 내용은 사전 고지 후 변경되거나 중단될 수 있습니다.
        </p>
      </section>

      <section className="flex flex-col gap-os-2">
        <h2 className="font-os font-semibold text-os-text" style={H2_STYLE}>
          준거법
        </h2>
        <p className="font-os text-os-text-2" style={BODY_STYLE}>
          이 약관은 대한민국 법을 따릅니다.
        </p>
      </section>

      <p className="font-os text-os-text-2" style={BODY_STYLE}>
        시행일{' '}
        <time dateTime={OPERATOR.effectiveDate}>
          {operatorFieldOrPending(OPERATOR.effectiveDate)}
        </time>
      </p>
    </div>
  );
}

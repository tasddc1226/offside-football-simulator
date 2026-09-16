import { buttonClassName, buttonStyle, Card } from '@offside/ui';
import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { HomeCommunity } from './home-community.js';
import { SUPPORT_EMAIL } from './home-notices.js';
export { SUPPORT_EMAIL } from './home-notices.js';

const COPY = {
  guide: {
    title: '게임 가이드',
    description:
      '오프사이드의 선수 생성, 시즌 진행, 선택과 성장, 이적과 은퇴 흐름을 처음부터 알아봅니다.',
  },
  faq: {
    title: '자주 묻는 질문',
    description:
      '오프사이드의 저장 방식, 진행 방법, 지원 문의 등 게임 이용 전에 궁금한 점을 확인하세요.',
  },
} as const;

export function PublicSeoHead({ page }: { page: keyof typeof COPY }) {
  const copy = COPY[page];
  useEffect(() => {
    document.title = `${copy.title} | OFFSIDE`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute('content', `${copy.title} | OFFSIDE`);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute('content', copy.description);
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        'content',
        document.documentElement.dataset.publicRobots ?? 'noindex, nofollow',
      );
  }, [copy]);
  return null;
}

export function PublicFooter() {
  return (
    <nav
      className="flex flex-wrap justify-center gap-os-4 border-t border-os-border pt-os-4"
      aria-label="공개 안내"
    >
      <a href="/guide" className="font-os text-os-text-2">
        게임 가이드
      </a>
      <a href="/faq" className="font-os text-os-text-2">
        자주 묻는 질문
      </a>
      <a className="font-os text-os-text-2" href={`mailto:${SUPPORT_EMAIL}`}>
        고객 지원
      </a>
    </nav>
  );
}

export function PublicIntroduction() {
  return (
    <div className="os-screen">
      <section className="flex flex-col gap-os-4 py-os-4">
        <p className="os-eyebrow">FOOTBALL CAREER STORY</p>
        <h1
          className="font-os font-bold text-os-text"
          style={{ fontSize: 'var(--os-fs-h1)', lineHeight: 'var(--os-lh-h1)' }}
        >
          OFFSIDE
        </h1>
        <p className="font-os font-semibold text-os-text">
          이번 생은 프리미어리거! 한 명의 선수로 데뷔부터 은퇴까지.
        </p>
        <p className="max-w-prose font-os text-os-text-2">
          유망주가 되어 훈련과 경기 사이의 선택을 내리고, 시즌을 거듭하며 한 선수의 축구 인생을
          만들어 가는 커리어 스토리 시뮬레이션입니다.
        </p>
        <div className="flex flex-col gap-os-2 sm:flex-row">
          <Link
            to="/onboarding"
            className={buttonClassName('primary', 'w-full')}
            style={buttonStyle}
          >
            내 선수 만들기
          </Link>
          <a href="/guide" className={buttonClassName('secondary', 'w-full')} style={buttonStyle}>
            먼저 게임 알아보기
          </a>
        </div>
      </section>
      <section aria-labelledby="career-story" className="flex flex-col gap-os-3">
        <h2 id="career-story" className="os-section-title">
          선택이 쌓여 선수가 됩니다
        </h2>
        <ol className="grid gap-os-3 border-y border-os-border py-os-3">
          <li className="grid grid-cols-[2rem_1fr] gap-os-3">
            <span className="os-num font-os font-bold text-os-accent">01</span>
            <div>
              <h3 className="font-os font-semibold text-os-text">19세 유망주 만들기</h3>
              <p className="mt-os-1 font-os text-os-text-2">
                이름, 성장 배경, 성별과 선호 포지션, 플레이 성향을 정하고 프로 무대를 향한 첫
                커리어를 시작합니다.
              </p>
            </div>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-os-3">
            <span className="os-num font-os font-bold text-os-accent">02</span>
            <div>
              <h3 className="font-os font-semibold text-os-text">시즌과 경기 이야기</h3>
              <p className="mt-os-1 font-os text-os-text-2">
                경기 일정과 커리어 사건을 만나고, 매 순간의 선택에 따라 성장과 다음 기회가
                달라집니다.
              </p>
            </div>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-os-3">
            <span className="os-num font-os font-bold text-os-accent">03</span>
            <div>
              <h3 className="font-os font-semibold text-os-text">이적부터 은퇴까지</h3>
              <p className="mt-os-1 font-os text-os-text-2">
                제안을 검토하고 팀을 옮기며 기록을 쌓아, 한 선수의 커리어를 마지막까지 완성합니다.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <HomeCommunity compact />
      <PublicFooter />
    </div>
  );
}

export function GuideContent() {
  return (
    <div className="os-screen">
      <PublicSeoHead page="guide" />
      <header>
        <p className="os-eyebrow">HOW TO PLAY</p>
        <h1 className="font-os font-bold text-os-text">게임 가이드</h1>
        <p className="font-os text-os-text-2">
          한 명의 선수를 만들고 시즌과 선택을 이어 가는 기본 흐름입니다.
        </p>
      </header>
      <section className="os-panel">
        <h2 className="os-section-title">1. 선수 생성</h2>
        <p className="mt-os-2 font-os text-os-text-2">
          19세 유망주의 이름, 성장 배경, 성별, 선호 포지션과 플레이 성향을 선택합니다. 선호 포지션은
          선수의 출발점이며 실제 역할은 커리어 선택에 따라 달라질 수 있습니다.
        </p>
      </section>
      <section className="os-panel">
        <h2 className="os-section-title">2. 시즌 진행</h2>
        <p className="mt-os-2 font-os text-os-text-2">
          시즌 준비 뒤 일정에 따라 경기와 커리어 사건이 이어집니다. 경기 전 컨디션과 체력을 살피고,
          결과 화면에서 기록과 능력치 변화를 확인할 수 있습니다.
        </p>
      </section>
      <section className="os-panel">
        <h2 className="os-section-title">3. 선택과 성장</h2>
        <p className="mt-os-2 font-os text-os-text-2">
          OVR 하나만 올리는 방식이 아니라 기술, 신체, 멘탈 등 여러 능력치와 상태가 함께 변합니다.
          선택에는 즉시 보이는 결과와 이후 커리어에 반영되는 결과가 있습니다.
        </p>
      </section>
      <section className="os-panel">
        <h2 className="os-section-title">4. 계약, 이적, 은퇴</h2>
        <p className="mt-os-2 font-os text-os-text-2">
          커리어가 진행되면 조건에 따라 계약과 이적 제안을 만날 수 있습니다. 특정 제안이나 팀은
          보장되지 않으며, 은퇴 뒤에는 완성한 선수의 발자취를 돌아볼 수 있습니다.
        </p>
      </section>
      <Link to="/onboarding" className={buttonClassName('primary', 'w-full')} style={buttonStyle}>
        첫 커리어 시작
      </Link>
      <PublicFooter />
    </div>
  );
}

export function FaqContent() {
  return (
    <div className="os-screen">
      <PublicSeoHead page="faq" />
      <header>
        <p className="os-eyebrow">HELP</p>
        <h1 className="font-os font-bold text-os-text">자주 묻는 질문</h1>
        <p className="font-os text-os-text-2">
          게임을 시작하거나 이어 할 때 필요한 답을 모았습니다.
        </p>
      </header>
      <section className="flex flex-col gap-os-3">
        <Card>
          <h2 className="os-section-title">어떤 게임인가요?</h2>
          <p className="mt-os-2 font-os text-os-text-2">
            축구 선수 한 명의 입장에서 선택하고 시즌을 진행하는 커리어 스토리 시뮬레이션입니다.
          </p>
        </Card>
        <Card>
          <h2 className="os-section-title">진행 내용은 어디에 저장되나요?</h2>
          <p className="mt-os-2 font-os text-os-text-2">
            익명으로 바로 시작할 수 있으며 현재 기기의 브라우저 저장소를 우선 사용합니다. 설정에서
            Google 연결, 동기화 상태와 복구 코드를 확인할 수 있습니다. 브라우저 데이터를 지우기
            전에는 복구 수단을 먼저 준비하세요.
          </p>
        </Card>
        <Card>
          <h2 className="os-section-title">서비스 시즌과 선수 시즌은 다른가요?</h2>
          <p className="mt-os-2 font-os text-os-text-2">
            서비스 시즌은 적용되는 게임 규칙과 콘텐츠의 운영 단위이고, 선수 시즌은 각 커리어 안에서
            진행되는 축구 시즌입니다. 기존 커리어는 생성 당시 표시된 규칙·콘텐츠 버전을 유지할 수
            있습니다.
          </p>
        </Card>
        <Card>
          <h2 className="os-section-title">여러 커리어를 만들 수 있나요?</h2>
          <p className="mt-os-2 font-os text-os-text-2">
            커리어 허브에서 새 선수를 만들고, 진행 중인 선수와 은퇴 기록을 나누어 볼 수 있습니다.
          </p>
        </Card>
        <Card>
          <h2 className="os-section-title">문제가 생겼어요.</h2>
          <p className="mt-os-2 font-os text-os-text-2">
            사용 환경과 문제가 발생한 화면을 적어{' '}
            <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            으로 보내 주세요. 복구 코드나 개인 정보는 공개 게시물에 올리지 마세요.
          </p>
        </Card>
      </section>
      <PublicFooter />
    </div>
  );
}

import { useEffect, useState } from 'react';

/**
 * DSN-LINE-001 오프사이드 라인. 등장 허용 순간은 KICKOFF·FULL TIME·THE LINE HAS MOVED
 * 세 개뿐이다(13-visual-design-system.md). 이 작업의 어떤 화면에도 렌더하지 않는다.
 * 라인 색은 Tailwind 유틸리티로 노출하지 않으므로(다른 화면의 남용 방지) 이 컴포넌트만
 * 해당 CSS 변수를 인라인 스타일로 직접 참조한다.
 */
export function OffsideLine() {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const classes = [
    'h-[2px] w-full origin-left transition-transform duration-[320ms] ease-out lg:h-[3px]',
    entered ? 'scale-x-100' : 'scale-x-0',
  ].join(' ');

  return <div aria-hidden="true" className={classes} style={{ backgroundColor: 'var(--os-line)' }} />;
}

import type { DetailsHTMLAttributes, ReactNode } from 'react';

export interface DisclosureProps extends Omit<DetailsHTMLAttributes<HTMLDetailsElement>, 'title'> {
  /** summary에 보일 제목. 항상 보이며 클릭하면 children을 펼치고 접는다. */
  summary: ReactNode;
  children: ReactNode;
}

/**
 * 네이티브 `<details>`/`<summary>` 기반 접이식 섹션(UX-003). 저사용 항목을 기본 접힘으로 둬 첫
 * 화면을 가볍게 할 때 쓴다. 브라우저 기본 동작 덕에 접혀 있어도 그 안의 요소로 향하는 페이지 내
 * 앵커(`#id`)를 누르면 자동으로 펼쳐진다.
 */
export function Disclosure({ summary, children, className, ...props }: DisclosureProps) {
  const classes = ['os-disclosure', className].filter(Boolean).join(' ');

  return (
    <details className={classes} {...props}>
      <summary className="os-disclosure-summary font-os font-semibold text-os-text">
        <span>{summary}</span>
        <span className="os-disclosure-arrow" aria-hidden="true" />
      </summary>
      <div className="os-disclosure-content">{children}</div>
    </details>
  );
}

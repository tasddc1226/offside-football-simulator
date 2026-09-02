export interface CareerTimelineItem {
  id: string;
  age: string | number;
  stage: string;
  title: string;
  subtitle?: string;
}

export interface CareerTimelineProps {
  items: CareerTimelineItem[];
  /** items가 비었을 때 보여줄 문구. 기본값을 두지 않는다(호출자 필수 지정). */
  emptyMessage: string;
}

export function CareerTimeline({ items, emptyMessage }: CareerTimelineProps) {
  if (items.length === 0) {
    return (
      <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-os-3">
          <div className="flex flex-col items-center">
            <span aria-hidden="true" className="mt-os-1 h-os-1 w-os-1 flex-none rounded-full bg-os-border" />
            {index < items.length - 1 ? <span aria-hidden="true" className="w-px flex-1 bg-os-border" /> : null}
          </div>
          <div className="flex flex-col gap-os-1 pb-os-4">
            <div className="flex items-baseline gap-os-2 font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
              <span className="os-num">{item.age}</span>
              <span>{item.stage}</span>
            </div>
            <p className="font-os font-semibold text-os-text" style={{ fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' }}>
              {item.title}
            </p>
            {item.subtitle ? (
              <p className="font-os text-os-text-2" style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}>
                {item.subtitle}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

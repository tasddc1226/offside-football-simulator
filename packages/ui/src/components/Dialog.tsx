import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps, ReactNode } from 'react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  /** 대화상자 제목. Radix Title로 렌더한다. */
  title: string;
  /** 대화상자 설명. Radix Description으로 렌더한다. 없으면 Radix가 자동으로 aria-describedby를 비운다. */
  description?: string;
  /** 닫기 버튼의 접근성 이름. */
  closeLabel: string;
  children?: ReactNode;
}

export function DialogContent({
  title,
  description,
  closeLabel,
  className,
  children,
  ...props
}: DialogContentProps) {
  const contentClasses = [
    'os-dialog fixed left-1/2 top-1/2 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 border border-os-border bg-os-surface p-os-5 outline-none',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="os-dialog-overlay fixed inset-0 bg-os-text/50" />
      <DialogPrimitive.Content className={contentClasses} {...props}>
        <DialogPrimitive.Title
          className="font-os font-bold text-os-text"
          style={{ fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' }}
        >
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description
            className="font-os text-os-text-2"
            style={{ fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' }}
          >
            {description}
          </DialogPrimitive.Description>
        ) : null}
        <div className="mt-os-4">{children}</div>
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute right-os-3 top-os-3 inline-flex items-center justify-center rounded-os-s outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus"
          style={{ minHeight: 'var(--os-touch-min)', minWidth: 'var(--os-touch-min)' }}
        >
          <span aria-hidden="true">✕</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

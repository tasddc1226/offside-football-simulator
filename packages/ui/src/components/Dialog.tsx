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
      <DialogPrimitive.Overlay className="os-dialog-overlay fixed inset-0" />
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

export interface SheetContentProps
  extends Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> {
  /** 시트 제목. Radix Title로 렌더한다(role="dialog"의 aria-labelledby 대상). */
  title: string;
  /** 닫기 버튼의 접근성 이름. */
  closeLabel: string;
  children?: ReactNode;
}

/**
 * 360px에서는 화면 하단에서 올라오는 바텀시트, 720px 이상에서는 가운데 모달(max-width 560px)로
 * 반응하는 Radix Dialog Content 변형. `DialogContent`와 같은 Portal·Overlay·포커스 트랩·
 * role="dialog"/aria-modal을 그대로 쓰되, 제목·닫기 버튼을 한 줄 머리글로 고정하고 본문만
 * 스크롤한다(하단 safe-area 패딩 포함) — 긴 약관·개인정보 처리방침 본문을 시트 안에서 읽기 위함.
 * 반응형 배치·모션은 sheet-motion.css가 전담한다(모바일: 슬라이드업, 데스크톱: 중앙 페이드).
 */
export function SheetContent({
  title,
  closeLabel,
  className,
  children,
  ...props
}: SheetContentProps) {
  const contentClasses = ['os-sheet flex flex-col outline-none', className]
    .filter(Boolean)
    .join(' ');

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="os-dialog-overlay fixed inset-0" />
      <DialogPrimitive.Content className={contentClasses} {...props}>
        <div className="os-sheet-header flex items-center justify-between gap-os-3 border-b border-os-border px-os-5 py-os-4">
          <DialogPrimitive.Title
            className="font-os font-bold text-os-text"
            style={{ fontSize: 'var(--os-fs-h2)', lineHeight: 'var(--os-lh-h2)' }}
          >
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="inline-flex flex-none items-center justify-center rounded-os-s outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus"
            style={{ minHeight: 'var(--os-touch-min)', minWidth: 'var(--os-touch-min)' }}
          >
            <span aria-hidden="true">✕</span>
          </DialogPrimitive.Close>
        </div>
        <div
          className="os-sheet-body min-h-0 flex-1 overflow-y-auto px-os-5 py-os-4"
          style={{ paddingBottom: 'calc(var(--os-safe-bottom) + var(--os-space-4))' }}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

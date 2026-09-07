import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ComponentProps, KeyboardEvent } from 'react';

export type RadioGroupProps = ComponentProps<typeof RadioGroupPrimitive.Root>;
export type RadioGroupItemProps = ComponentProps<typeof RadioGroupPrimitive.Item>;

const ITEM_BASE_CLASS =
  'os-radio-item block w-full rounded-os-m border border-os-border bg-os-surface text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60';

export function RadioGroup({ className, ...props }: RadioGroupProps) {
  const classes = ['flex flex-col gap-os-3', className].filter(Boolean).join(' ');
  return <RadioGroupPrimitive.Root className={classes} {...props} />;
}

export function RadioGroupItem({ className, style, onKeyDown, ...props }: RadioGroupItemProps) {
  const classes = [ITEM_BASE_CLASS, className].filter(Boolean).join(' ');

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Enter') return;
    // Radix의 RadioGroupItem은 기본적으로 Enter의 default action만 막고 선택은 하지 않는다
    // (폼 submit 억제 목적). 여기서 클릭을 합성해 포커스된 항목을 선택한다. 이미 선택된
    // 항목이면 Radix RadioTrigger의 onClick이 `!checked`일 때만 onCheck()를 호출하므로
    // 값 변경 이벤트가 중복 발생하지 않는다.
    event.preventDefault();
    event.currentTarget.click();
  }

  return (
    <RadioGroupPrimitive.Item
      className={classes}
      style={{ minHeight: 'var(--os-touch-min)', ...style }}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

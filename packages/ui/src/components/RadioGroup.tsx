import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ComponentProps } from 'react';

export type RadioGroupProps = ComponentProps<typeof RadioGroupPrimitive.Root>;
export type RadioGroupItemProps = ComponentProps<typeof RadioGroupPrimitive.Item>;

const ITEM_BASE_CLASS =
  'block w-full rounded-os-m border border-os-border bg-os-surface text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60';

export function RadioGroup({ className, ...props }: RadioGroupProps) {
  const classes = ['flex flex-col gap-os-3', className].filter(Boolean).join(' ');
  return <RadioGroupPrimitive.Root className={classes} {...props} />;
}

export function RadioGroupItem({ className, style, ...props }: RadioGroupItemProps) {
  const classes = [ITEM_BASE_CLASS, className].filter(Boolean).join(' ');
  return (
    <RadioGroupPrimitive.Item
      className={classes}
      style={{ minHeight: 'var(--os-touch-min)', ...style }}
      {...props}
    />
  );
}

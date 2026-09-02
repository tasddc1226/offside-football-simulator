import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';

export type TabsProps = ComponentProps<typeof TabsPrimitive.Root>;
export type TabsListProps = ComponentProps<typeof TabsPrimitive.List>;
export type TabsTriggerProps = ComponentProps<typeof TabsPrimitive.Trigger>;
export type TabsContentProps = ComponentProps<typeof TabsPrimitive.Content>;

export function Tabs({ className, ...props }: TabsProps) {
  const classes = ['flex flex-col gap-os-3', className].filter(Boolean).join(' ');
  return <TabsPrimitive.Root className={classes} {...props} />;
}

export function TabsList({ className, ...props }: TabsListProps) {
  const classes = ['flex gap-os-2 border-b border-os-border', className].filter(Boolean).join(' ');
  return <TabsPrimitive.List className={classes} {...props} />;
}

export function TabsTrigger({ className, style, ...props }: TabsTriggerProps) {
  const classes = [
    'font-os font-semibold text-os-text-2 outline-none border-b-2 border-transparent px-os-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus data-[state=active]:border-os-accent data-[state=active]:text-os-text data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <TabsPrimitive.Trigger
      className={classes}
      style={{
        minHeight: 'var(--os-touch-min)',
        fontSize: 'var(--os-fs-body)',
        lineHeight: 'var(--os-lh-body)',
        ...style,
      }}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsContentProps) {
  const classes = ['outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-os-focus', className]
    .filter(Boolean)
    .join(' ');
  return <TabsPrimitive.Content className={classes} {...props} />;
}

// Shared compact records controls. The selection sheet keeps native safe areas and touch targets.
import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useColors } from '../../theme/useColors';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { SelectField, type SelectOption } from '../settings/parts';
import { hofText as L } from '@offside/app-core/i18n/ko/hof';

export const RECORDS_TOUCH = Platform.OS === 'android' ? 48 : 44;

export function RecordsSelect<V extends string | number>({
  value,
  options,
  onChange,
  label,
  testID,
}: {
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  label: string;
  testID: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Txt tone="muted" style={{ fontSize: 12 }}>
        {label}
      </Txt>
      <SelectField
        compact
        value={value}
        options={options}
        onChange={onChange}
        label={label}
        testID={testID}
      />
    </View>
  );
}

export function RecordsFilters({
  season,
  label,
  open,
  onToggle,
  testID,
  children,
}: {
  season: ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  testID: string;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {season}
        {children ? (
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Txt tone="muted" style={{ fontSize: 12 }}>
              {L.filter}
            </Txt>
            <Press
              testID={testID}
              scale={1}
              accessibilityLabel={L.filterA11y({ label })}
              accessibilityState={{ expanded: open }}
              onPress={onToggle}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 4,
                minHeight: RECORDS_TOUCH,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 10,
                paddingHorizontal: 10,
                backgroundColor: c.surface2,
              }}
            >
              <Txt numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
                {label}
              </Txt>
              <Txt accessible={false} tone="muted" style={{ fontSize: 12 }}>
                {open ? '▴' : '▾'}
              </Txt>
            </Press>
          </View>
        ) : null}
      </View>
      {open && children ? (
        <View
          testID={`${testID}-panel`}
          style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line, gap: 8 }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function RecordsChips({
  label,
  items,
  value,
  onPick,
  testIDPrefix,
}: {
  label: string;
  items: readonly { key: string; label: string; isNew?: boolean }[];
  value: string;
  onPick: (value: string) => void;
  testIDPrefix: string;
}) {
  const c = useColors();
  return (
    <View accessibilityLabel={label} style={{ gap: 4 }}>
      <Txt tone="muted" style={{ fontSize: 12 }}>
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item) => (
          <Press
            key={item.key}
            scale={1}
            testID={`${testIDPrefix}-${item.key}`}
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.key === value }}
            onPress={() => onPick(item.key)}
            style={{ minHeight: RECORDS_TOUCH, justifyContent: 'center' }}
          >
            <View
              style={{
                minHeight: 32,
                justifyContent: 'center',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: item.key === value ? c.ink : c.line,
                backgroundColor: item.key === value ? c.ink : c.surface2,
              }}
            >
              <Txt
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: item.key === value ? c.surface : c.ink,
                }}
              >
                {item.label}
                {item.isNew ? ' · NEW' : ''}
              </Txt>
            </View>
          </Press>
        ))}
      </View>
    </View>
  );
}

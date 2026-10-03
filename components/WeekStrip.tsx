// Seven-day picker under the Today header. Dots mark days with food logged.
import { radius, space, useTheme } from '@/constants/theme';
import { addDays, dateFromKey, weekdayInitial, weekOf } from '@/services/dates';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './ui/AppText';
import { IconButton } from './ui/IconButton';
import { PressableScale } from './ui/PressableScale';

interface WeekStripProps {
  selected: string;
  today: string;
  loggedDays: Set<string>;
  onSelect: (date: string) => void;
}

export function WeekStrip({ selected, today, loggedDays, onSelect }: WeekStripProps) {
  const theme = useTheme();
  const days = weekOf(selected);
  const isCurrentWeek = days.includes(today);
  return (
    <View style={styles.row}>
      <IconButton
        icon="chevron-back"
        variant="plain"
        size={30}
        accessibilityLabel="Previous week"
        onPress={() => onSelect(addDays(selected, -7))}
      />
      <View style={styles.days}>
        {days.map(day => {
          const isSelected = day === selected;
          const isToday = day === today;
          const future = day > today;
          const logged = loggedDays.has(day);
          const label = dateFromKey(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
          return (
            <PressableScale
              key={day}
              onPress={() => onSelect(day)}
              disabled={future}
              haptic="selection"
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={`${label}${isToday ? ', today' : ''}${logged ? ', food logged' : ''}`}
              accessibilityState={{ selected: isSelected, disabled: future }}
              style={styles.day}
            >
              <AppText variant="micro" tone={isSelected ? 'brand' : 'tertiary'}>{weekdayInitial(day)}</AppText>
              <View
                style={[
                  styles.circle,
                  isSelected && { backgroundColor: theme.brand },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.brand },
                ]}
              >
                <AppText
                  variant="headline"
                  numeric
                  color={isSelected ? theme.onBrand : isToday ? theme.brandText : theme.text}
                  weight={isSelected || isToday ? '700' : '500'}
                >
                  {dateFromKey(day).getDate()}
                </AppText>
              </View>
              <View style={[styles.dot, { backgroundColor: logged ? theme.brand : 'transparent' }]} />
            </PressableScale>
          );
        })}
      </View>
      <IconButton
        icon="chevron-forward"
        variant="plain"
        size={30}
        accessibilityLabel="Next week"
        disabled={isCurrentWeek}
        onPress={() => {
          const next = addDays(selected, 7);
          onSelect(next > today ? today : next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
  },
  days: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});

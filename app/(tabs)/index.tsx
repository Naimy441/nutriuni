import { DayView } from '@/components/DayView';
import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { useTabBarSpace } from '@/components/ui/TabBar';
import { WeekStrip } from '@/components/WeekStrip';
import { space, useTheme } from '@/constants/theme';
import { greeting, longDayLabel, relativeDayLabel } from '@/services/dates';
import { useLoggedDays, useToday } from '@/services/NutritionTracker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TodayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarSpace();
  const today = useToday();
  const [selected, setSelected] = useState(today);
  const loggedDays = useLoggedDays();
  const logged = useMemo(() => new Set(loggedDays), [loggedDays]);

  // After midnight, follow the new day if the old "today" was showing.
  const previousToday = useRef(today);
  useEffect(() => {
    if (previousToday.current !== today) {
      setSelected(current => (current === previousToday.current ? today : current));
      previousToday.current = today;
    }
  }, [today]);

  const isToday = selected === today;
  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <AppText variant="subhead" tone="secondary" weight="600">
            {isToday ? greeting() : longDayLabel(selected)}
          </AppText>
          <AppText variant="largeTitle" accessibilityRole="header">
            {isToday ? 'Today' : relativeDayLabel(selected, today)}
          </AppText>
        </View>
        {!isToday && <Chip label="Today" icon="arrow-undo" onPress={() => setSelected(today)} />}
      </View>
      <WeekStrip selected={selected} today={today} loggedDays={logged} onSelect={setSelected} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <DayView date={selected} today={today} header={header} bottomPadding={bottomPadding} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    gap: space.lg,
    paddingTop: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  titleText: {
    flex: 1,
  },
});

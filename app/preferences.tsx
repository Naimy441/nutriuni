import { AllergyFields, DietaryDisclaimer, DietFields, ScheduleFields } from '@/components/PreferenceFields';
import { AppText } from '@/components/ui/AppText';
import { space, useTheme } from '@/constants/theme';
import { preferencesStore, usePreferences } from '@/services/preferences';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Changes apply as soon as they're made: meals, suggestions and menus follow.
export default function PreferencesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { food, schedule } = usePreferences();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]}
    >
      <Section title="How you eat" subtitle="Sets which meals you see and how your day is planned.">
        <ScheduleFields value={schedule} onChange={patch => preferencesStore.update({ schedule: patch })} />
      </Section>
      <Section title="Diet" subtitle="Suggestions only include dishes marked as fitting.">
        <DietFields value={food} onChange={patch => preferencesStore.update({ food: patch })} />
      </Section>
      <Section title="Allergies" subtitle="Dishes marked with these are left out of suggestions and flagged on menus.">
        <AllergyFields value={food.avoid} onChange={avoid => preferencesStore.update({ food: { avoid } })} />
      </Section>
      <DietaryDisclaimer />
    </ScrollView>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View>
        <AppText variant="title3" accessibilityRole="header">{title}</AppText>
        <AppText variant="footnote" tone="secondary">{subtitle}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    gap: space.xxl,
  },
  section: {
    gap: space.md,
  },
});

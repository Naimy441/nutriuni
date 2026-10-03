// Inputs for how someone eats and what they eat, shared by onboarding and
// Profile → Food preferences.
import { radius, space, useTheme } from '@/constants/theme';
import { dayKey } from '@/services/dates';
import { ALLERGENS, Allergen, Diet, FoodPreferences } from '@/services/dietary';
import { clockLabel, fastingTimes } from '@/services/fastingTimes';
import { EatingSchedule, SCHEDULES } from '@/services/schedule';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { OptionCard } from './ProfileFields';
import { AppText } from './ui/AppText';
import { PressableScale } from './ui/PressableScale';
import { Segmented } from './ui/Segmented';
import { Stepper } from './ui/Stepper';

export function ScheduleFields({ value, onChange }: { value: EatingSchedule; onChange: (next: Partial<EatingSchedule>) => void }) {
  const theme = useTheme();
  const today = fastingTimes(dayKey());
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {SCHEDULES.map(option => (
        <View key={option.kind} style={styles.options}>
          <OptionCard
            icon={option.icon}
            label={option.label}
            detail={option.detail}
            selected={value.kind === option.kind}
            onPress={() => onChange({ kind: option.kind })}
          />
          {value.kind === 'window' && option.kind === 'window' && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.extra, { backgroundColor: theme.fill }]}>
              <WindowRow
                label="First meal"
                value={value.window.start}
                min={0}
                max={value.window.end - 120}
                onChange={start => onChange({ window: { ...value.window, start } })}
              />
              <WindowRow
                label="Last meal by"
                value={value.window.end}
                min={value.window.start + 120}
                max={24 * 60}
                onChange={end => onChange({ window: { ...value.window, end } })}
              />
            </Animated.View>
          )}
          {value.kind === 'ramadan' && option.kind === 'ramadan' && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.extra, { backgroundColor: theme.fill }]}>
              <AppText variant="footnote" tone="secondary">
                Today in Durham, suhoor ends at {clockLabel(today.fajr)} and iftar is at {clockLabel(today.maghrib)}. Times are
                calculated for each day (ISNA method); check your masjid&apos;s timetable.
              </AppText>
            </Animated.View>
          )}
        </View>
      ))}
    </View>
  );
}

function WindowRow({ label, value, min, max, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.windowRow}>
      <AppText variant="callout" style={styles.flex}>{label}</AppText>
      <Stepper value={value} onChange={onChange} min={min} max={max} step={30} format={clockLabel} label={label} />
    </View>
  );
}

const DIETS: { value: Diet; label: string }[] = [
  { value: 'none', label: 'No restriction' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
];

export function DietFields({ value, onChange }: { value: FoodPreferences; onChange: (next: Partial<FoodPreferences>) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Segmented options={DIETS} value={value.diet} onChange={diet => onChange({ diet })} />
      <Pressable
        onPress={() => onChange({ halal: !value.halal })}
        style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.separator }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: value.halal }}
      >
        <View style={styles.flex}>
          <AppText variant="callout" weight="600">Halal</AppText>
          <AppText variant="footnote" tone="tertiary">Halal-certified dishes, plus vegetarian ones</AppText>
        </View>
        <Switch
          value={value.halal}
          onValueChange={halal => onChange({ halal })}
          trackColor={{ true: theme.brand, false: theme.fillStrong }}
          accessibilityLabel="Halal"
        />
      </Pressable>
    </View>
  );
}

export function AllergyFields({ value, onChange }: { value: Allergen[]; onChange: (avoid: Allergen[]) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.chips}>
      {ALLERGENS.map(allergen => {
        const selected = value.includes(allergen.code);
        return (
          <PressableScale
            key={allergen.code}
            onPress={() => onChange(selected ? value.filter(code => code !== allergen.code) : [...value, allergen.code])}
            haptic="selection"
            scaleTo={0.95}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: theme.dangerSoft, borderColor: theme.danger }
                : { backgroundColor: theme.surface, borderColor: theme.separator },
            ]}
          >
            {selected && <Ionicons name="close-circle" size={16} color={theme.danger} />}
            <AppText variant="subhead" weight="600" color={selected ? theme.danger : theme.text}>{allergen.label}</AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function DietaryDisclaimer() {
  return (
    <AppText variant="caption" tone="tertiary">
      Allergen and diet info isn&apos;t available for every dish, and cross-contact is always possible. With a serious allergy,
      check with dining staff before you eat.
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  options: {
    gap: space.sm,
  },
  extra: {
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  group: {
    gap: space.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md + 2,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});

import { NumberField } from '@/components/ProfileFields';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { NUTRIENTS, formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { calculateGoals, goalsStore, NutritionGoals, useGoals } from '@/services/goals';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FIELDS: { key: keyof NutritionGoals; min: number; max: number }[] = [
  { key: 'calories', min: 800, max: 6000 },
  { key: 'protein', min: 10, max: 400 },
  { key: 'carbs', min: 0, max: 900 },
  { key: 'fat', min: 10, max: 300 },
  { key: 'fiber', min: 0, max: 100 },
  { key: 'sugar', min: 0, max: 300 },
  { key: 'sodium', min: 0, max: 10000 },
];

type Draft = Record<keyof NutritionGoals, string>;

function toDraft(goals: NutritionGoals): Draft {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, String(Math.round(goals[key]))])) as Draft;
}

export default function GoalsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { goals, profile } = useGoals();
  const [draft, setDraft] = useState<Draft>(() => toDraft(goals));
  const [submitted, setSubmitted] = useState(false);

  const errors: Partial<Record<keyof NutritionGoals, string>> = {};
  for (const { key, min, max } of FIELDS) {
    const value = Number(draft[key]);
    if (draft[key] === '' || !Number.isFinite(value) || value < min || value > max) {
      errors[key] = `Enter ${min.toLocaleString()}–${max.toLocaleString()}`;
    }
  }
  const valid = Object.keys(errors).length === 0;
  const macroCalories = (Number(draft.protein) || 0) * 4 + (Number(draft.carbs) || 0) * 4 + (Number(draft.fat) || 0) * 9;
  const calorieTarget = Number(draft.calories) || 0;
  const mismatch = calorieTarget > 0 && Math.abs(macroCalories - calorieTarget) > calorieTarget * 0.1;

  const save = async () => {
    setSubmitted(true);
    if (!valid) return;
    const next = Object.fromEntries(FIELDS.map(({ key }) => [key, Math.round(Number(draft[key]))])) as unknown as NutritionGoals;
    await goalsStore.saveGoals(next);
    toast.show({ message: 'Targets saved' });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <AppText variant="subhead" tone="secondary">
          Set your own daily targets, or use the ones recommended for your details and goal.
        </AppText>
        {profile && (
          <Button
            title="Use recommended targets"
            icon="sparkles-outline"
            variant="tinted"
            size="md"
            onPress={() => setDraft(toDraft(calculateGoals(profile)))}
          />
        )}

        <View style={styles.grid}>
          {FIELDS.map(({ key }) => (
            <View key={key} style={key === 'calories' ? styles.full : styles.half}>
              <NumberField
                label={NUTRIENTS[key].label}
                unit={NUTRIENTS[key].unit}
                value={draft[key]}
                onChange={text => setDraft(prev => ({ ...prev, [key]: text }))}
                error={submitted ? errors[key] : undefined}
                maxLength={5}
              />
            </View>
          ))}
        </View>

        <View style={[styles.check, { backgroundColor: mismatch ? theme.warningSoft : theme.fill }]}>
          <AppText variant="footnote" tone={mismatch ? 'warning' : 'secondary'}>
            Protein, carbs and fat add up to {formatNumber(macroCalories)} cal
            {mismatch ? `, which doesn't match your ${formatNumber(calorieTarget)} cal target.` : '.'}
          </AppText>
        </View>
        <AppText variant="caption" tone="tertiary">
          Sugar and sodium are daily limits; the others are targets to reach.
        </AppText>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg), borderTopColor: theme.separator }]}>
        <Button title="Save targets" onPress={save} haptic="medium" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.huge,
    gap: space.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.lg,
  },
  full: {
    width: '100%',
  },
  half: {
    width: '48%',
  },
  check: {
    padding: space.md,
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

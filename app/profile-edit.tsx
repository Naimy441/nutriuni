import { ActivityPicker, BodyFields, ClassYearPicker, draftFromProfile, GoalPicker, profileFromDraft, ProfileDraft, SexPicker, validateDraft } from '@/components/ProfileFields';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { space, useTheme } from '@/constants/theme';
import { goalsStore, useGoals } from '@/services/goals';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileEditScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useGoals();
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = submitted ? validateDraft(draft) : {};
  const update = (patch: Partial<ProfileDraft>) => setDraft(prev => ({ ...prev, ...patch }));

  const save = async () => {
    setSubmitted(true);
    const next = profileFromDraft(draft);
    if (!next || saving) return;
    setSaving(true);
    const goals = await goalsStore.saveProfile(next);
    setSaving(false);
    toast.show({ message: `Plan updated · ${goals.calories.toLocaleString()} cal a day` });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Section title="Goal" error={errors.goal}>
          <GoalPicker value={draft.goal} onChange={goal => update({ goal })} />
        </Section>
        <Section title="Sex" subtitle="Used to calculate how much energy you need each day." error={errors.gender}>
          <SexPicker value={draft.gender} onChange={gender => update({ gender })} />
        </Section>
        <Section title="Body">
          <BodyFields draft={draft} onChange={update} errors={errors} />
        </Section>
        <Section title="Activity" error={errors.activityLevel}>
          <ActivityPicker value={draft.activityLevel} onChange={activityLevel => update({ activityLevel })} />
        </Section>
        <Section
          title="Class year"
          subtitle="Marketplace and Trinity are first-year dining. They show up in your meal plan only for first-years."
          error={errors.classYear}
        >
          <ClassYearPicker value={draft.classYear} onChange={classYear => update({ classYear })} />
        </Section>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg), backgroundColor: theme.background, borderTopColor: theme.separator }]}>
        <AppText variant="caption" tone="tertiary" align="center">Saving recalculates your daily targets.</AppText>
        <Button title="Save" onPress={save} loading={saving} haptic="medium" />
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ title, subtitle, error, children }: { title: string; subtitle?: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View>
        <AppText variant="title3" accessibilityRole="header">{title}</AppText>
        {subtitle ? <AppText variant="footnote" tone="secondary">{subtitle}</AppText> : null}
      </View>
      {children}
      {error ? <AppText variant="footnote" tone="danger">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.huge,
    gap: space.xxl,
  },
  section: {
    gap: space.md,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

// First run: value props, then goal → sex → body → activity, ending with the
// personal plan. Everything can be changed later in Profile.
import { formatNumber } from '@/constants/nutrients';
import { radius, shadow, space, useTheme } from '@/constants/theme';
import { calculateGoals, goalsStore, WEIGHT_GOALS } from '@/services/goals';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityPicker, BodyFields, DraftErrors, GoalPicker, profileFromDraft, ProfileDraft, SexPicker, validateDraft,
} from './ProfileFields';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { AppText } from './ui/AppText';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { ProgressBar } from './ui/ProgressBar';
import { ProgressRing } from './ui/ProgressRing';

type Step = 'welcome' | 'goal' | 'sex' | 'body' | 'activity' | 'plan';
const STEPS: Step[] = ['welcome', 'goal', 'sex', 'body', 'activity', 'plan'];

const STEP_TEXT: Partial<Record<Step, { title: string; subtitle: string }>> = {
  goal: { title: 'What’s your goal?', subtitle: 'We’ll set your daily calories and macros around it.' },
  sex: { title: 'Sex', subtitle: 'The standard formula for daily energy needs differs by sex.' },
  body: { title: 'About you', subtitle: 'Used only to calculate your targets. It stays on your phone.' },
  activity: { title: 'How active are you?', subtitle: 'Count workouts and walking around campus.' },
};

const STEP_FIELDS: Partial<Record<Step, (keyof DraftErrors)[]>> = {
  goal: ['goal'],
  sex: ['gender'],
  body: ['age', 'height', 'weight'],
  activity: ['activityLevel'],
};

const VALUE_PROPS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  { icon: 'restaurant', title: 'Every Duke dining menu', body: 'With nutrition from Duke NetNutrition, updated daily.' },
  { icon: 'options', title: 'Build your order', body: 'Pick sides and toppings and watch calories update live.' },
  { icon: 'flash', title: 'Log in one tap', body: 'Recents, saved meals and a clear calories-left number.' },
];

export function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [draft, setDraft] = useState<ProfileDraft>({ age: '', weight: '', heightFeet: '', heightInches: '' });
  const [attempted, setAttempted] = useState<Set<Step>>(new Set());
  const [saving, setSaving] = useState(false);
  const step = STEPS[index];
  const update = (patch: Partial<ProfileDraft>) => setDraft(prev => ({ ...prev, ...patch }));

  const allErrors = validateDraft(draft);
  const stepErrors: DraftErrors = {};
  for (const field of STEP_FIELDS[step] ?? []) {
    if (allErrors[field]) stepErrors[field] = allErrors[field];
  }
  const stepValid = Object.keys(stepErrors).length === 0;
  const shownErrors = attempted.has(step) ? stepErrors : {};

  const go = (delta: 1 | -1) => {
    setDirection(delta);
    setIndex(i => Math.max(0, Math.min(STEPS.length - 1, i + delta)));
  };

  const next = () => {
    if (!stepValid) {
      setAttempted(prev => new Set(prev).add(step));
      return;
    }
    go(1);
  };

  // Choices advance on their own; typing steps wait for Continue.
  const advancing = useRef(false);
  const choose = (patch: Partial<ProfileDraft>) => {
    update(patch);
    if (advancing.current) return;
    advancing.current = true;
    setTimeout(() => {
      advancing.current = false;
      go(1);
    }, 220);
  };

  const finish = async () => {
    const profile = profileFromDraft(draft);
    if (!profile) return;
    setSaving(true);
    await goalsStore.completeOnboarding(profile);
  };

  const entering = (direction > 0 ? FadeInRight : FadeInLeft).duration(280);

  if (step === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg }]}>
        <ScrollView contentContainerStyle={styles.welcome} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(500)} style={[styles.logoTile, shadow(theme, 2)]}>
            <Image source={require('@/assets/images/nutriuni.png')} style={styles.logo} contentFit="contain" accessibilityLabel="nutriuni" />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.welcomeText}>
            <AppText variant="largeTitle" align="center">Eat well at Duke</AppText>
            <AppText variant="body" tone="secondary" align="center">
              The calorie and macro tracker built around Duke dining.
            </AppText>
          </Animated.View>
          <View style={styles.props}>
            {VALUE_PROPS.map((prop, i) => (
              <Animated.View key={prop.title} entering={FadeInDown.delay(260 + i * 110).duration(450)} style={styles.prop}>
                <View style={[styles.propIcon, { backgroundColor: theme.brandSoft }]}>
                  <Ionicons name={prop.icon} size={22} color={theme.brandText} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="headline">{prop.title}</AppText>
                  <AppText variant="subhead" tone="secondary">{prop.body}</AppText>
                </View>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
        <Animated.View entering={FadeIn.delay(600)} style={styles.footer}>
          <Button title="Get started" trailingIcon="arrow-forward" onPress={() => go(1)} haptic="medium" />
          <Button title="Skip — use a 2,000 cal default" variant="ghost" size="md" onPress={() => goalsStore.skipOnboarding()} />
        </Animated.View>
      </View>
    );
  }

  const text = STEP_TEXT[step];
  const questionCount = STEPS.length - 2;
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top + space.sm }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => go(-1)} />
        <ProgressBar progress={Math.min(index, questionCount) / questionCount} color={theme.brand} height={6} style={styles.flex} />
        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.stepContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={step} entering={entering} exiting={FadeOut.duration(120)} style={styles.step}>
          {text && (
            <View style={styles.stepHeader}>
              <AppText variant="title1" accessibilityRole="header">{text.title}</AppText>
              <AppText variant="subhead" tone="secondary">{text.subtitle}</AppText>
            </View>
          )}
          {step === 'goal' && <GoalPicker value={draft.goal} onChange={goal => choose({ goal })} />}
          {step === 'sex' && <SexPicker value={draft.gender} onChange={gender => choose({ gender })} />}
          {step === 'body' && <BodyFields draft={draft} onChange={update} errors={shownErrors} />}
          {step === 'activity' && <ActivityPicker value={draft.activityLevel} onChange={activityLevel => choose({ activityLevel })} />}
          {step === 'plan' && <PlanReveal draft={draft} />}
          {Object.values(shownErrors).length > 0 && step !== 'body' && (
            <AppText variant="footnote" tone="danger">{Object.values(shownErrors)[0]}</AppText>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {step === 'plan' ? (
          <Button title="Start tracking" icon="checkmark" onPress={finish} loading={saving} haptic="medium" />
        ) : (
          <Button title="Continue" onPress={next} haptic="light" />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function PlanReveal({ draft }: { draft: ProfileDraft }) {
  const theme = useTheme();
  const profile = profileFromDraft(draft);
  if (!profile) return null;
  const goals = calculateGoals(profile);
  const goal = WEIGHT_GOALS.find(g => g.value === profile.goal);
  const macroCalories = goals.protein * 4 + goals.carbs * 4 + goals.fat * 9 || 1;
  const adjustment = profile.goal === 'lose' ? ', minus 500 to lose about 1 lb a week' : profile.goal === 'gain' ? ', plus 300 for a gradual surplus' : '';
  return (
    <View style={styles.plan}>
      <View style={styles.stepHeader}>
        <AppText variant="title1" accessibilityRole="header">Your daily plan</AppText>
        <AppText variant="subhead" tone="secondary">{goal?.label ?? 'Your goal'} · you can change this anytime in Profile.</AppText>
      </View>
      <Animated.View entering={FadeIn.duration(400)} style={styles.planRing}>
        <ProgressRing size={200} stroke={16} progress={1} color={theme.calories}>
          <AnimatedNumber value={goals.calories} from={0} variant="display" duration={1100} />
          <AppText variant="subhead" tone="secondary">calories a day</AppText>
        </ProgressRing>
      </Animated.View>
      <View style={styles.planMacros}>
        {(['protein', 'carbs', 'fat'] as const).map((key, i) => {
          const share = Math.round(((key === 'fat' ? goals[key] * 9 : goals[key] * 4) / macroCalories) * 100);
          return (
            <Animated.View
              key={key}
              entering={FadeInDown.delay(400 + i * 120).duration(400)}
              style={[styles.planMacro, { backgroundColor: theme.surface, borderColor: theme.separator }]}
            >
              <View style={[styles.dot, { backgroundColor: theme[key] }]} />
              <AppText variant="title3" numeric>{formatNumber(goals[key])} g</AppText>
              <AppText variant="caption" tone="secondary">
                {key === 'protein' ? 'Protein' : key === 'carbs' ? 'Carbs' : 'Fat'} · {share}%
              </AppText>
            </Animated.View>
          );
        })}
      </View>
      <Animated.View entering={FadeIn.delay(800)} style={[styles.planNote, { backgroundColor: theme.fill }]}>
        <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
        <AppText variant="footnote" tone="secondary" style={styles.flex}>
          Estimated from the Mifflin-St Jeor equation and your activity{adjustment}. A starting point, not medical advice.
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  welcome: {
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    gap: space.xxl,
    paddingBottom: space.xl,
  },
  logoTile: {
    width: 132,
    height: 132,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
  },
  logo: {
    width: 104,
    height: 104,
  },
  welcomeText: {
    gap: space.sm,
  },
  props: {
    alignSelf: 'stretch',
    gap: space.xl,
    marginTop: space.sm,
  },
  prop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  propIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.xs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  topSpacer: {
    width: 36,
  },
  stepContent: {
    padding: space.xl,
    paddingTop: space.xxl,
  },
  step: {
    gap: space.xl,
  },
  stepHeader: {
    gap: space.xs,
  },
  plan: {
    gap: space.xl,
  },
  planRing: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  planMacros: {
    flexDirection: 'row',
    gap: space.md,
  },
  planMacro: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: space.xs,
  },
  planNote: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
});

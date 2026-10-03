import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Segmented } from '@/components/ui/Segmented';
import { useTabBarSpace } from '@/components/ui/TabBar';
import { useToast } from '@/components/ui/Toast';
import { formatNumber } from '@/constants/nutrients';
import { radius, space, useTheme } from '@/constants/theme';
import { appearanceStore, useAppearance } from '@/services/appearance';
import { fastAccessService } from '@/services/FastAccessService';
import { ACTIVITY_LEVELS, calculateGoals, goalsStore, useGoals, WEIGHT_GOALS } from '@/services/goals';
import { menuDatabase, useMenuRevision } from '@/services/MenuDatabase';
import { nutritionTracker } from '@/services/NutritionTracker';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd8wtBFaxivHiQ8seqSm7Ya8AMbqx3J2T6Py-U74hPZdvMzJw/viewform?usp=sharing&ouid=114705869524362385356';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = useTabBarSpace();
  const router = useRouter();
  const toast = useToast();
  const { goals, profile, planner } = useGoals();
  const appearance = useAppearance();
  useMenuRevision();
  const [checking, setChecking] = useState(false);

  const goal = WEIGHT_GOALS.find(g => g.value === profile?.goal);
  const activity = ACTIVITY_LEVELS.find(a => a.value === profile?.activityLevel);
  const calculated = profile ? calculateGoals(profile) : null;
  const custom = calculated
    ? (['calories', 'protein', 'carbs', 'fat'] as const).some(key => calculated[key] !== goals[key])
    : true;

  const checkForMenus = async () => {
    setChecking(true);
    const changed = await menuDatabase.refresh({ force: true });
    setChecking(false);
    toast.show({ message: changed ? 'Menus updated' : 'Menus are up to date', icon: 'refresh' });
  };

  const resetAll = () => {
    Alert.alert(
      'Erase all data?',
      'This deletes your food log, saved meals, details and targets from this phone. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            await nutritionTracker.clearAll();
            await fastAccessService.clearAll();
            await goalsStore.reset();
          },
        },
      ],
    );
  };

  const updated = new Date(menuDatabase.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="largeTitle" accessibilityRole="header">Profile</AppText>
        </View>

        <Card style={[styles.plan, { backgroundColor: theme.hero, borderColor: 'transparent' }]} onPress={() => router.push('/goals')} accessibilityLabel="Your daily plan. Edit targets">
          <View style={styles.planTop}>
            <View style={styles.flex}>
              <AppText variant="footnote" weight="600" color={theme.onHero} style={styles.planEyebrow}>
                {custom ? 'YOUR CUSTOM PLAN' : goal ? goal.label.toUpperCase() : 'YOUR DAILY PLAN'}
              </AppText>
              <AppText variant="display" numeric color={theme.onHero}>{formatNumber(goals.calories)}</AppText>
              <AppText variant="subhead" color={theme.onHero} style={styles.planSub}>calories a day</AppText>
            </View>
            <View style={[styles.editPill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <AppText variant="caption" weight="700" color={theme.onHero}>Edit</AppText>
            </View>
          </View>
          <View style={styles.planMacros}>
            {(['protein', 'carbs', 'fat'] as const).map(key => (
              <View key={key} style={[styles.planMacro, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                <AppText variant="headline" numeric color={theme.onHero}>{formatNumber(goals[key])} g</AppText>
                <AppText variant="caption" color={theme.onHero} style={styles.planSub}>
                  {key === 'protein' ? 'Protein' : key === 'carbs' ? 'Carbs' : 'Fat'}
                </AppText>
              </View>
            ))}
          </View>
        </Card>

        <ListGroup title="Your plan">
          <ListRow
            icon="person-outline"
            title="Your details"
            subtitle={profile
              ? `${profile.age} yrs · ${profile.heightFeet}′${profile.heightInches}″ · ${profile.weight} lb · ${activity?.label ?? 'Custom activity'}`
              : 'Add your details for personal targets'}
            onPress={() => router.push('/profile-edit')}
          />
          <ListRow icon="options-outline" title="Daily targets" value={custom ? 'Custom' : 'Recommended'} onPress={() => router.push('/goals')} divider />
          <ListRow
            icon="calendar-outline"
            title="Meal plan"
            subtitle={planner.balanceWeek ? 'Balancing your week' : 'Weekly balancing off'}
            onPress={() => router.push('/plan')}
            divider
          />
        </ListGroup>

        <ListGroup title="Appearance">
          <View style={styles.appearance}>
            <Segmented
              options={[
                { value: 'system', label: 'Automatic' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={appearance}
              onChange={value => appearanceStore.set(value)}
            />
          </View>
        </ListGroup>

        <ListGroup title="Dining data" footer="Menus refresh automatically a few times a day.">
          <ListRow
            icon="refresh-outline"
            title="Check for new menus"
            subtitle={`Last updated ${updated}`}
            onPress={checking ? undefined : checkForMenus}
            accessory={checking ? <ActivityIndicator size="small" color={theme.brand} /> : undefined}
          />
          <ListRow icon="library-outline" title="Sources & methods" subtitle="How nutrition and targets are calculated" onPress={() => router.push('/sources')} divider />
        </ListGroup>

        <ListGroup title="Support">
          <ListRow icon="chatbubble-ellipses-outline" title="Send feedback" subtitle="Request a feature or report a bug" external onPress={() => WebBrowser.openBrowserAsync(FEEDBACK_URL).catch(() => {})} />
        </ListGroup>

        <ListGroup footer="Your log, details and targets are stored only on this phone.">
          <ListRow icon="trash-outline" title="Erase all data" destructive onPress={resetAll} />
        </ListGroup>

        <View style={styles.footer}>
          <AppText variant="caption" tone="tertiary" align="center">nutriuni {version}</AppText>
          <AppText variant="caption" tone="tertiary" align="center">
            For general information only. Not medical advice — talk to a healthcare provider about your diet.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: space.md,
    paddingHorizontal: space.xs,
  },
  plan: {
    padding: space.xl,
    gap: space.lg,
    borderRadius: radius.xxl,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planEyebrow: {
    letterSpacing: 0.6,
    opacity: 0.85,
  },
  planSub: {
    opacity: 0.85,
  },
  editPill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  planMacros: {
    flexDirection: 'row',
    gap: space.sm,
  },
  planMacro: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  appearance: {
    padding: space.md,
  },
  footer: {
    gap: space.xs,
    paddingHorizontal: space.xl,
  },
});

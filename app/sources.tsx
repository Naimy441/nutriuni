import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { radius, space, useTheme } from '@/constants/theme';
import { CITATIONS } from '@/constants/sources';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const METHODS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
  {
    icon: 'restaurant-outline',
    title: 'Menus',
    body: 'Dishes, options and hours come from Duke Mobile Order and refresh a few times a day. Dining halls not on Mobile Order list what Duke NetNutrition publishes for them.',
  },
  {
    icon: 'pricetag-outline',
    title: 'Nutrition',
    body: 'Every number comes from a Duke NetNutrition label matched to the dish and each option you choose. Combos and build-your-own dishes add up their parts and are marked “~” as estimates. When Duke hasn’t published a label, you can enter your own.',
  },
  {
    icon: 'calculator-outline',
    title: 'Your targets',
    body: 'Calories use the Mifflin-St Jeor equation × your activity level, −500 a day to lose about 1 lb a week or +300 to build muscle (never below 1,200). Protein is 1.6 g per kg, fat 28% of calories and carbs the rest. Fiber is 14 g per 1,000 calories, sugar follows American Heart Association limits and sodium is under 2,300 mg.',
  },
];

export default function SourcesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]}
    >
      <View style={styles.section}>
        <AppText variant="title3" accessibilityRole="header">How nutriuni works</AppText>
        {METHODS.map(method => (
          <Card key={method.title} style={styles.method}>
            <View style={[styles.icon, { backgroundColor: theme.brandSoft }]}>
              <Ionicons name={method.icon} size={18} color={theme.brandText} />
            </View>
            <View style={styles.flex}>
              <AppText variant="headline">{method.title}</AppText>
              <AppText variant="subhead" tone="secondary">{method.body}</AppText>
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.section}>
        <AppText variant="title3" accessibilityRole="header">References</AppText>
        <View style={[styles.list, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
          {CITATIONS.map((citation, index) => (
            <View
              key={citation.term}
              style={[styles.citation, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}
            >
              <AppText variant="headline">{citation.term}</AppText>
              <AppText variant="subhead" tone="secondary">{citation.definition}</AppText>
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(citation.url).catch(() => {})}
                style={styles.link}
                hitSlop={6}
                accessibilityRole="link"
                accessibilityLabel={`Source: ${citation.source}`}
              >
                <AppText variant="footnote" weight="600" tone="brand" style={styles.flexShrink}>{citation.source}</AppText>
                <Ionicons name="open-outline" size={13} color={theme.brandText} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.disclaimer, { backgroundColor: theme.fill }]}>
        <Ionicons name="medkit-outline" size={18} color={theme.textSecondary} />
        <AppText variant="footnote" tone="secondary" style={styles.flex}>
          nutriuni provides nutrition information for general education only. It isn’t medical advice. Talk to a doctor or registered dietitian before making changes to your diet, especially if you have a health condition or a history of disordered eating.
        </AppText>
      </View>
    </ScrollView>
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
  flex: {
    flex: 1,
    gap: 2,
  },
  flexShrink: {
    flexShrink: 1,
  },
  method: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  citation: {
    padding: space.lg,
    gap: space.xs,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
});

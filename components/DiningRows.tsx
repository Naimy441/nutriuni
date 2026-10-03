// List rows shared by the Dining tab, restaurant pages and the Log screen.
import { radius, space, useTheme } from '@/constants/theme';
import { menuDatabase, OpenStatus, RestaurantSummary } from '@/services/MenuDatabase';
import type { PreviewKind } from '@/services/menuNutrition';
import type { MenuItem } from '@/services/menuTypes';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CaloriePill } from './CaloriePill';
import { HalalTag } from './MenuItemSheet';
import { AppText } from './ui/AppText';
import { PressableScale } from './ui/PressableScale';

export function RestaurantIcon({ restaurant, size = 48 }: { restaurant: RestaurantSummary; size?: number }) {
  const theme = useTheme();
  const icon = menuDatabase.icon(restaurant.id);
  const style = { width: size, height: size, borderRadius: size * 0.26 };
  if (icon) {
    return (
      <Image
        source={icon}
        style={[style, { backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.separator }]}
        contentFit="contain"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[style, styles.iconFallback, { backgroundColor: theme.brandSoft }]}>
      <Ionicons name={restaurant.source === 'netnutrition' ? 'business-outline' : 'restaurant-outline'} size={size * 0.45} color={theme.brandText} />
    </View>
  );
}

export function StatusLine({ status, fallback, detail }: { status: OpenStatus | null; fallback?: string; detail?: string }) {
  const theme = useTheme();
  if (status?.label) {
    return (
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: status.isOpen ? theme.success : theme.textTertiary }]} />
        <AppText variant="footnote" numberOfLines={1} style={styles.shrink}>
          <AppText variant="footnote" weight={status.isOpen ? '600' : '400'} color={status.isOpen ? theme.success : theme.textSecondary}>
            {status.label}
          </AppText>
          {detail ? <AppText variant="footnote" tone="tertiary">{`  ·  ${detail}`}</AppText> : null}
        </AppText>
      </View>
    );
  }
  return fallback ? <AppText variant="footnote" tone="secondary" numberOfLines={1}>{fallback}</AppText> : null;
}

export function RestaurantRow({
  restaurant, status, onPress,
}: {
  restaurant: RestaurantSummary;
  status: OpenStatus | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.restaurant, { backgroundColor: theme.surface, borderColor: theme.separator }]}
      accessibilityLabel={`${restaurant.name}. ${status?.label ?? ''}`}
    >
      <RestaurantIcon restaurant={restaurant} />
      <View style={styles.flex}>
        <AppText variant="headline" numberOfLines={1}>{restaurant.name}</AppText>
        <StatusLine
          status={status}
          fallback={restaurant.with_nutrition === 0 ? 'Dining hall · No nutrition info' : 'Dining hall'}
          detail={restaurant.with_nutrition === 0 ? 'No nutrition info' : undefined}
        />
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </PressableScale>
  );
}

export function DishRow({
  item, subtitle, preview, onPress, onQuickAdd, adding, divider = true,
}: {
  item: MenuItem;
  subtitle?: string;
  preview: { kind: PreviewKind; calories?: number };
  onPress: () => void;
  onQuickAdd?: () => void;
  adding?: boolean;
  divider?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.dish, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
      <Pressable
        style={({ pressed }) => [styles.dishMain, pressed && { opacity: 0.6 }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Shows nutrition and options"
      >
        <View style={styles.dishTitle}>
          <AppText variant="callout" weight="600" style={styles.shrink}>{item.name}</AppText>
          {item.halal && <HalalTag />}
        </View>
        {subtitle ? <AppText variant="footnote" tone="tertiary" numberOfLines={1}>{subtitle}</AppText> : null}
        {item.description ? (
          <AppText variant="footnote" tone="secondary" numberOfLines={2}>{item.description}</AppText>
        ) : null}
        <View style={styles.dishMeta}>
          <CaloriePill kind={preview.kind} calories={preview.calories} />
          {item.price !== undefined && <AppText variant="footnote" tone="secondary">${item.price.toFixed(2)}</AppText>}
        </View>
      </Pressable>
      {onQuickAdd && (
        <PressableScale
          onPress={onQuickAdd}
          disabled={adding}
          haptic="light"
          scaleTo={0.88}
          hitSlop={6}
          style={[styles.add, { backgroundColor: theme.brandSoft }]}
          accessibilityLabel={`Add ${item.name}`}
        >
          {adding ? <ActivityIndicator size="small" color={theme.brandText} /> : <Ionicons name="add" size={22} color={theme.brandText} />}
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    gap: 2,
  },
  shrink: {
    flexShrink: 1,
  },
  iconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  restaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  dishMain: {
    flex: 1,
    gap: 3,
  },
  dishTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: 3,
  },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

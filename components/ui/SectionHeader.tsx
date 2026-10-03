import { space } from '@/constants/theme';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        <AppText variant="title3" accessibilityRole="header">{title}</AppText>
        {subtitle ? <AppText variant="footnote" tone="secondary">{subtitle}</AppText> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <AppText variant="subhead" weight="600" tone="brand">{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

import { space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, message, actionLabel, onAction, compact, style }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.container, compact && styles.compact, style]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.brandSoft }, compact && styles.iconCircleSmall]}>
        <Ionicons name={icon} size={compact ? 22 : 30} color={theme.brandText} />
      </View>
      <AppText variant={compact ? 'headline' : 'title3'} align="center">{title}</AppText>
      {message ? <AppText variant="subhead" tone="secondary" align="center" style={styles.message}>{message}</AppText> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="tinted" size="md" style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: space.huge,
    paddingHorizontal: space.xxl,
    gap: space.sm,
  },
  compact: {
    paddingVertical: space.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  iconCircleSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  message: {
    maxWidth: 300,
  },
  action: {
    marginTop: space.md,
  },
});

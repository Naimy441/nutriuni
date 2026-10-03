import { radius, space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { triggerHaptic } from './PressableScale';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ListRowProps {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  external?: boolean; // opens outside the app
  divider?: boolean;
  accessory?: React.ReactNode;
}

// A settings-style row for grouped lists.
export function ListRow({
  icon, iconColor, title, subtitle, value, onPress, destructive, external, divider, accessory,
}: ListRowProps) {
  const theme = useTheme();
  const tint = destructive ? theme.danger : iconColor ?? theme.brandText;
  return (
    <Pressable
      onPress={onPress ? () => {
        triggerHaptic('selection');
        onPress();
      } : undefined}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.fill }]}
      accessibilityRole={onPress ? (external ? 'link' : 'button') : undefined}
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join(', ')}
    >
      {icon && (
        <View style={[styles.icon, { backgroundColor: destructive ? theme.dangerSoft : theme.brandSoft }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      )}
      <View style={[styles.body, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }]}>
        <View style={styles.text}>
          <AppText variant="callout" weight="500" color={destructive ? theme.danger : theme.text}>{title}</AppText>
          {subtitle ? <AppText variant="footnote" tone="tertiary">{subtitle}</AppText> : null}
        </View>
        {value ? <AppText variant="callout" tone="secondary" numeric>{value}</AppText> : null}
        {accessory}
        {onPress && !destructive && (
          <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={external ? 16 : 18} color={theme.textTertiary} />
        )}
      </View>
    </Pressable>
  );
}

export function ListGroup({ children, title, footer }: { children: React.ReactNode; title?: string; footer?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      {title ? <AppText variant="footnote" tone="secondary" weight="600" style={styles.groupTitle}>{title.toUpperCase()}</AppText> : null}
      <View style={[styles.groupBody, { backgroundColor: theme.surface, borderColor: theme.separator }]}>{children}</View>
      {footer ? <AppText variant="caption" tone="tertiary" style={styles.groupTitle}>{footer}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    minHeight: 52,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.md,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingRight: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  group: {
    gap: space.sm,
  },
  groupTitle: {
    paddingHorizontal: space.xs,
    letterSpacing: 0.4,
  },
  groupBody: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});

// App-wide toast ("Logged Chicken Tikka · 520 cal   Undo"), shown above the
// tab bar. Use: const toast = useToast(); toast.show({ message, action }).
import { radius, shadow, space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';

interface ToastOptions {
  message: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  action?: { label: string; onPress: () => void };
  tone?: 'success' | 'neutral' | 'error';
  duration?: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {}, hide: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// Screens with a tab bar lift toasts above it.
const TAB_BAR_CLEARANCE = 92;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { key: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    if (options.tone !== 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setToast({ ...options, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), options.duration ?? (options.action ? 4500 : 2600));
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && <ToastView key={toast.key} toast={toast} onDismiss={hide} />}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastOptions; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const iconColor = toast.tone === 'error' ? '#FF8A8A' : '#5ED596';
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOutDown.duration(180)}
        style={[
          styles.toast,
          { bottom: insets.bottom + TAB_BAR_CLEARANCE, backgroundColor: theme.scheme === 'dark' ? '#26302B' : '#17221C' },
          shadow(theme, 3),
        ]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Pressable style={styles.body} onPress={onDismiss}>
          <Ionicons name={toast.icon ?? (toast.tone === 'error' ? 'alert-circle' : 'checkmark-circle')} size={22} color={iconColor} />
          <AppText variant="subhead" weight="600" color="#FFFFFF" style={styles.message} numberOfLines={2}>
            {toast.message}
          </AppText>
        </Pressable>
        {toast.action && (
          <Pressable
            hitSlop={10}
            onPress={() => {
              toast.action?.onPress();
              onDismiss();
            }}
            style={styles.action}
            accessibilityRole="button"
          >
            <AppText variant="subhead" weight="700" color="#5ED596">{toast.action.label}</AppText>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingLeft: space.lg,
    minHeight: 56,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  message: {
    flex: 1,
  },
  action: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});

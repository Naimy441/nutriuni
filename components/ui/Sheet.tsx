// Shared styling for bottom sheets (backdrop, handle, background, insets).
import { radius, useTheme } from '@/constants/theme';
import {
  BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetModal, BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SheetRef = BottomSheetModal;

export const Sheet = forwardRef<BottomSheetModal, BottomSheetModalProps>(function Sheet(props, ref) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="close" />
    ),
    [],
  );
  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top + 8}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: theme.scheme === 'dark' ? theme.surface : theme.background, borderRadius: radius.xxl }}
      handleIndicatorStyle={{ backgroundColor: theme.fillStrong, width: 40, height: 5 }}
      {...props}
    />
  );
});

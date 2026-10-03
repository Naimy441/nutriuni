import { radius, space, useTheme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef } from 'react';
import { Pressable, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  style?: StyleProp<ViewStyle>;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { value, onChangeText, placeholder = 'Search', style, ...rest },
  ref,
) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.fill }, style]}>
      <Ionicons name="search" size={18} color={theme.textTertiary} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        style={[styles.input, { color: theme.text }]}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        selectionColor={theme.brand}
        accessibilityLabel={placeholder}
        {...rest}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    height: 44,
  },
});

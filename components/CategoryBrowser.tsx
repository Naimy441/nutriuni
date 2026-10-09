// Steps through every section of a menu. Previous and next stay on screen
// (and a matching control sits at the bottom of a long list) so choosing one
// category never leaves the rest of the menu unreachable.
import { space } from '@/constants/theme';
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';

export const CATEGORY_ALL = '__all__';

export function categoryLabel(name: string): string {
  return name === CATEGORY_ALL ? 'All' : name;
}

export function categoryOrder(names: string[]): string[] {
  return [CATEGORY_ALL, ...names];
}

export function adjacentCategory(names: string[], value: string, delta: number): string {
  const order = categoryOrder(names);
  const index = Math.max(0, order.indexOf(value));
  return order[(index + delta + order.length) % order.length];
}

export function CategoryBrowser({ names, value, onChange }: {
  names: string[];
  value: string;
  onChange: (name: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const order = categoryOrder(names);

  useEffect(() => {
    const x = positions.current[value];
    if (x != null) scrollRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
  }, [value, names]);

  const go = (delta: number) => onChange(adjacentCategory(names, value, delta));
  const previous = adjacentCategory(names, value, -1);
  const next = adjacentCategory(names, value, 1);

  return (
    <View style={styles.row}>
      <IconButton icon="chevron-back" variant="plain" accessibilityLabel={`Previous category, ${categoryLabel(previous)}`} onPress={() => go(-1)} />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.scroll}
      >
        {order.map(name => (
          <View
            key={name}
            onLayout={event => {
              positions.current[name] = event.nativeEvent.layout.x;
            }}
          >
            <Chip
              label={categoryLabel(name)}
              selected={value === name}
              onPress={() => onChange(name)}
            />
          </View>
        ))}
      </ScrollView>
      <IconButton icon="chevron-forward" variant="plain" accessibilityLabel={`Next category, ${categoryLabel(next)}`} onPress={() => go(1)} />
    </View>
  );
}

export function CategoryStep({ names, value, onChange }: {
  names: string[];
  value: string;
  onChange: (name: string) => void;
}) {
  const next = adjacentCategory(names, value, 1);
  const previous = adjacentCategory(names, value, -1);
  const atAll = value === CATEGORY_ALL;
  return (
    <View style={styles.step}>
      {!atAll && (
        <Button
          title={`Previous: ${categoryLabel(previous)}`}
          icon="chevron-back"
          variant="secondary"
          size="md"
          onPress={() => onChange(previous)}
        />
      )}
      <Button
        title={atAll ? `Start with ${categoryLabel(adjacentCategory(names, value, 1))}` : `Next: ${categoryLabel(next)}`}
        trailingIcon="chevron-forward"
        variant="tinted"
        size="md"
        onPress={() => onChange(next)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  scroll: {
    flex: 1,
  },
  chips: {
    gap: space.sm,
    paddingVertical: 2,
  },
  step: {
    gap: space.sm,
  },
});

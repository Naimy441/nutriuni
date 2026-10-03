// A Nutrition Facts label in the FDA layout, and the ingredient statements
// behind it, for a dish as ordered.
import { space, useTheme } from '@/constants/theme';
import type { NutrientKey, NutritionPart, NutritionTotals } from '@/services/menuNutrition';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import { AppText } from './ui/AppText';

interface Row {
  key: NutrientKey;
  label: string;
  unit: 'g' | 'mg';
  dv?: number; // FDA Daily Value for adults, in the row's unit
  indent?: 1 | 2;
  bold?: boolean;
  optional?: boolean; // left off when no label lists it
}

const MACROS: Row[] = [
  { key: 'fat', label: 'Total Fat', unit: 'g', dv: 78, bold: true },
  { key: 'saturated_fat', label: 'Saturated Fat', unit: 'g', dv: 20, indent: 1 },
  { key: 'trans_fat', label: 'Trans Fat', unit: 'g', indent: 1, optional: true },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 300, bold: true },
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300, bold: true },
  { key: 'carbs', label: 'Total Carbohydrate', unit: 'g', dv: 275, bold: true },
  { key: 'fiber', label: 'Dietary Fiber', unit: 'g', dv: 28, indent: 1 },
  { key: 'sugar', label: 'Total Sugars', unit: 'g', indent: 1 },
  { key: 'added_sugar', label: 'Added Sugars', unit: 'g', dv: 50, indent: 2, optional: true },
];

const MINERALS: Row[] = [
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300, optional: true },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: 18, optional: true },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700, optional: true },
];

function amount(value: number, unit: string): string {
  const rounded = unit === 'mg' && value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

export function NutritionLabel({ totals, unknown, serving, servings, approx }: {
  totals: NutritionTotals;
  unknown: NutrientKey[];
  serving: string; // "Danish (113g)", or "Your order" for a built dish
  servings: number;
  approx?: boolean;
}) {
  const theme = useTheme();
  const ink = theme.text;
  const known = (key: NutrientKey) => !unknown.includes(key);
  const shown = (row: Row) => !row.optional || known(row.key);
  const minerals = MINERALS.filter(shown);
  const text = (style: TextStyle) => [styles.text, { color: ink }, style];
  const rule = (height: number) => <View style={{ height, backgroundColor: ink }} />;

  const renderRow = (row: Row, index: number) => {
    const has = known(row.key);
    const value = totals[row.key];
    const dv = row.dv && has ? `${Math.round((value / row.dv) * 100)}%` : '';
    const display = has ? amount(value, row.unit) : '—';
    return (
      <View key={row.key}>
        {index > 0 && <View style={[styles.thin, { backgroundColor: ink }, row.indent ? { marginLeft: 14 * row.indent } : null]} />}
        <View style={[styles.row, row.indent ? { paddingLeft: 14 * row.indent } : null]}>
          <Text style={text(styles.flex)} numberOfLines={1}>
            {row.key === 'added_sugar' ? (
              <>Includes <Text style={styles.bold}>{display}</Text> Added Sugars</>
            ) : (
              <>
                <Text style={row.bold ? styles.bold : null}>{row.label}</Text> {display}
              </>
            )}
          </Text>
          <Text style={text(styles.bold)}>{dv}</Text>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[styles.label, { borderColor: ink, backgroundColor: theme.surface }]}
      accessible
      accessibilityLabel={[
        `Nutrition facts. Serving size ${serving}.`,
        `${approx ? 'About ' : ''}${totals.calories} calories.`,
        ...[...MACROS, ...minerals].filter(row => shown(row) && known(row.key))
          .map(row => `${row.label} ${amount(totals[row.key], row.unit)}${row.dv ? `, ${Math.round((totals[row.key] / row.dv) * 100)} percent daily value` : ''}.`),
      ].join(' ')}
    >
      <Text style={text(styles.title)}>Nutrition Facts</Text>
      <View style={[styles.thin, { backgroundColor: ink }]} />
      <View style={styles.servingRow}>
        <Text style={text(styles.servingText)}>Serving size</Text>
        <Text style={text({ ...styles.servingText, ...styles.shrink, textAlign: 'right' })} numberOfLines={2}>
          {serving}{servings !== 1 ? ` × ${servings}` : ''}
        </Text>
      </View>
      {rule(10)}

      <Text style={text(styles.small)}>{servings === 1 ? 'Amount per serving' : `Amount for ${servings} servings`}</Text>
      <View style={styles.caloriesRow}>
        <Text style={text(styles.caloriesLabel)}>Calories</Text>
        <Text style={text(styles.caloriesValue)}>{approx ? '~' : ''}{totals.calories}</Text>
      </View>
      {rule(5)}

      <Text style={text({ ...styles.small, ...styles.bold, textAlign: 'right', marginVertical: 2 })}>% Daily Value*</Text>
      {MACROS.filter(shown).map(renderRow)}
      <View style={[styles.thin, { backgroundColor: ink }]} />
      <View style={styles.row}>
        <Text style={text(styles.flex)}>
          <Text style={styles.bold}>Protein</Text> {known('protein') ? amount(totals.protein, 'g') : '—'}
        </Text>
      </View>
      {rule(10)}

      {minerals.length > 0 && (
        <>
          {minerals.map(renderRow)}
          {rule(5)}
        </>
      )}
      <Text style={text(styles.footnote)}>
        * The % Daily Value tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories
        a day is used for general nutrition advice.
      </Text>
    </View>
  );
}

const COLLAPSED_LINES = 4;

// The ingredient statement of each part of an order.
export function IngredientList({ parts }: { parts: NutritionPart[] }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const seen = new Set<string>();
  const statements = parts
    .filter(part => part.sign > 0 && part.label.ingredients)
    .filter(part => !seen.has(part.label.name) && seen.add(part.label.name))
    .map(part => ({ name: part.label.name, text: part.label.ingredients! }));
  if (!statements.length) return null;
  const titled = statements.length > 1;
  const maxLines = COLLAPSED_LINES * statements.length;
  const body = statements.map((statement, index) => (
    <React.Fragment key={statement.name}>
      {index > 0 ? '\n\n' : ''}
      {titled ? <AppText variant="footnote" weight="700">{statement.name}: </AppText> : null}
      {statement.text}
    </React.Fragment>
  ));
  return (
    <View style={styles.ingredients}>
      <AppText variant="headline">Ingredients</AppText>
      <Pressable
        onPress={() => setExpanded(v => !v)}
        disabled={!truncated}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.ingredientBody}
      >
        {/* Measures the full text, so "Show all" only appears when it's cut off. */}
        <AppText
          variant="footnote"
          style={styles.measure}
          onTextLayout={event => setTruncated(event.nativeEvent.lines.length > maxLines)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {body}
        </AppText>
        <AppText variant="footnote" tone="secondary" numberOfLines={expanded ? undefined : maxLines}>{body}</AppText>
        {truncated && (
          <AppText variant="footnote" weight="600" tone="brand">{expanded ? 'Show less' : 'Show all'}</AppText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  label: {
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
  },
  bold: {
    fontWeight: '800',
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  thin: {
    height: StyleSheet.hairlineWidth * 2,
  },
  servingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 3,
  },
  servingText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  small: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -2,
    marginBottom: 2,
  },
  caloriesLabel: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
  },
  caloriesValue: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 3,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 5,
  },
  ingredients: {
    gap: space.xs,
  },
  ingredientBody: {
    gap: space.xs,
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
});

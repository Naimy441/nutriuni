// Inputs for the user's details, shared by onboarding and "Your details".
import { radius, space, useTheme } from '@/constants/theme';
import { ACTIVITY_LEVELS, Sex, UserProfile, WEIGHT_GOALS, WeightGoal } from '@/services/goals';
import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { AppText } from './ui/AppText';
import { PressableScale } from './ui/PressableScale';

export interface ProfileDraft {
  goal?: WeightGoal;
  gender?: Sex;
  age: string;
  weight: string;
  heightFeet: string;
  heightInches: string;
  activityLevel?: number;
}

export function draftFromProfile(profile: UserProfile | null): ProfileDraft {
  if (!profile) return { age: '', weight: '', heightFeet: '', heightInches: '' };
  return {
    goal: profile.goal,
    gender: profile.gender,
    age: String(profile.age),
    weight: String(profile.weight),
    heightFeet: String(profile.heightFeet),
    heightInches: String(profile.heightInches),
    activityLevel: profile.activityLevel,
  };
}

export type DraftErrors = Partial<Record<'goal' | 'gender' | 'age' | 'weight' | 'height' | 'activityLevel', string>>;

export function validateDraft(draft: ProfileDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.goal) errors.goal = 'Choose a goal';
  if (!draft.gender) errors.gender = 'Choose one';
  const age = Number(draft.age);
  if (!draft.age || !Number.isInteger(age) || age < 13 || age > 100) errors.age = 'Enter an age from 13 to 100';
  const weight = Number(draft.weight);
  if (!draft.weight || !Number.isFinite(weight) || weight < 70 || weight > 600) errors.weight = 'Enter a weight from 70 to 600 lb';
  const feet = Number(draft.heightFeet);
  const inches = draft.heightInches === '' ? 0 : Number(draft.heightInches);
  if (!draft.heightFeet || !Number.isInteger(feet) || feet < 3 || feet > 8 || !Number.isFinite(inches) || inches < 0 || inches > 11) {
    errors.height = 'Enter a height from 3′0″ to 8′11″';
  }
  if (!draft.activityLevel) errors.activityLevel = 'Choose an activity level';
  return errors;
}

export function profileFromDraft(draft: ProfileDraft): UserProfile | null {
  if (Object.keys(validateDraft(draft)).length) return null;
  return {
    goal: draft.goal!,
    gender: draft.gender!,
    age: Number(draft.age),
    weight: Math.round(Number(draft.weight) * 10) / 10,
    heightFeet: Number(draft.heightFeet),
    heightInches: draft.heightInches === '' ? 0 : Number(draft.heightInches),
    activityLevel: draft.activityLevel!,
  };
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function OptionCard({ icon, label, detail, selected, onPress }: {
  icon: IconName;
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.98}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[label, detail].filter(Boolean).join(', ')}
      style={[
        styles.option,
        {
          backgroundColor: selected ? theme.brandSoft : theme.surface,
          borderColor: selected ? theme.brand : theme.separator,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: selected ? theme.brand : theme.fill }]}>
        <Ionicons name={icon} size={20} color={selected ? theme.onBrand : theme.textSecondary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="headline">{label}</AppText>
        {detail ? <AppText variant="footnote" tone="secondary">{detail}</AppText> : null}
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? theme.brand : theme.textTertiary} />
    </PressableScale>
  );
}

export function GoalPicker({ value, onChange }: { value?: WeightGoal; onChange: (goal: WeightGoal) => void }) {
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {WEIGHT_GOALS.map(goal => (
        <OptionCard key={goal.value} icon={goal.icon} label={goal.label} detail={goal.detail} selected={value === goal.value} onPress={() => onChange(goal.value)} />
      ))}
    </View>
  );
}

export function ActivityPicker({ value, onChange }: { value?: number; onChange: (level: number) => void }) {
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {ACTIVITY_LEVELS.map(level => (
        <OptionCard key={level.value} icon={level.icon} label={level.label} detail={level.detail} selected={value === level.value} onPress={() => onChange(level.value)} />
      ))}
    </View>
  );
}

export function SexPicker({ value, onChange }: { value?: Sex; onChange: (sex: Sex) => void }) {
  return (
    <View style={styles.sexRow} accessibilityRole="radiogroup">
      {([
        { value: 'female' as const, label: 'Female', icon: 'female' as const },
        { value: 'male' as const, label: 'Male', icon: 'male' as const },
      ]).map(option => (
        <View key={option.value} style={styles.flex}>
          <OptionCard icon={option.icon} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />
        </View>
      ))}
    </View>
  );
}

interface NumberFieldProps extends Omit<TextInputProps, 'onChange' | 'value'> {
  label: string;
  unit: string;
  value: string;
  onChange: (text: string) => void;
  error?: string;
  decimal?: boolean;
}

export const NumberField = forwardRef<TextInput, NumberFieldProps>(function NumberField(
  { label, unit, value, onChange, error, decimal, ...rest },
  ref,
) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="footnote" tone="secondary" weight="600">{label}</AppText>
      <View style={[styles.input, { backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.separator }]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={text => onChange(text.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.brand}
          style={[styles.inputText, { color: theme.text }]}
          accessibilityLabel={`${label} in ${unit}`}
          {...rest}
        />
        <AppText variant="headline" tone="tertiary">{unit}</AppText>
      </View>
      {error ? <AppText variant="footnote" tone="danger">{error}</AppText> : null}
    </View>
  );
});

// Age, height and weight together.
export function BodyFields({ draft, onChange, errors }: {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  errors: DraftErrors;
}) {
  return (
    <View style={styles.body}>
      <NumberField label="Age" unit="years" value={draft.age} onChange={age => onChange({ age })} placeholder="20" maxLength={3} error={errors.age} />
      <View>
        <View style={styles.heightRow}>
          <View style={styles.flex}>
            <NumberField label="Height" unit="ft" value={draft.heightFeet} onChange={heightFeet => onChange({ heightFeet })} placeholder="5" maxLength={1} />
          </View>
          <View style={styles.flex}>
            <NumberField label=" " unit="in" value={draft.heightInches} onChange={heightInches => onChange({ heightInches })} placeholder="9" maxLength={2} accessibilityLabel="Height, inches" />
          </View>
        </View>
        {errors.height ? <AppText variant="footnote" tone="danger" style={styles.heightError}>{errors.height}</AppText> : null}
      </View>
      <NumberField label="Weight" unit="lb" value={draft.weight} onChange={weight => onChange({ weight })} placeholder="160" maxLength={5} decimal error={errors.weight} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  options: {
    gap: space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    minHeight: 64,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  body: {
    gap: space.lg,
  },
  field: {
    gap: space.xs,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    height: 58,
  },
  inputText: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    fontWeight: '700',
  },
  heightRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  heightError: {
    marginTop: space.xs,
  },
});

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

interface EditGoalsModalProps {
  visible: boolean;
  currentGoals: NutritionGoals;
  onClose: () => void;
  onSave: (goals: NutritionGoals) => void;
}

export function EditGoalsModal({ visible, currentGoals, onClose, onSave }: EditGoalsModalProps) {
  const colorScheme = useColorScheme();
  const [goals, setGoals] = useState<NutritionGoals>(currentGoals);
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when currentGoals change
  useEffect(() => {
    setGoals(currentGoals);
  }, [currentGoals]);

  const handleSave = async () => {
    // Validate inputs
    const isValid = Object.values(goals).every(value => value > 0 && value <= 10000);
    if (!isValid) {
      Alert.alert('Invalid Input', 'Please enter valid positive numbers for all goals.');
      return;
    }

    setIsSaving(true);
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem('nutrition_goals', JSON.stringify(goals));
      
      // Call parent callback
      onSave(goals);
      onClose();
      
      Alert.alert('Success', 'Your nutrition goals have been updated!');
    } catch (error) {
      console.error('Error saving goals:', error);
      Alert.alert('Error', 'Failed to save your goals. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setGoals(currentGoals);
    onClose();
  };

  const updateGoal = (key: keyof NutritionGoals, value: string) => {
    const numValue = parseFloat(value) || 0;
    setGoals(prev => ({ ...prev, [key]: numValue }));
  };

  const goalFields = [
    { key: 'calories' as keyof NutritionGoals, label: 'Calories', unit: 'kcal', placeholder: '2000' },
    { key: 'protein' as keyof NutritionGoals, label: 'Protein', unit: 'g', placeholder: '120' },
    { key: 'carbs' as keyof NutritionGoals, label: 'Carbohydrates', unit: 'g', placeholder: '250' },
    { key: 'fat' as keyof NutritionGoals, label: 'Fat', unit: 'g', placeholder: '65' },
    { key: 'fiber' as keyof NutritionGoals, label: 'Fiber', unit: 'g', placeholder: '25' },
    { key: 'sugar' as keyof NutritionGoals, label: 'Sugar', unit: 'g', placeholder: '50' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>Edit Goals</ThemedText>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            disabled={isSaving}
          >
            <ThemedText style={styles.saveText}>
              {isSaving ? 'Saving...' : 'Save'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.subtitle}>
            Adjust your daily nutrition targets
          </ThemedText>

          {goalFields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
                <ThemedText style={styles.fieldUnit}>{field.unit}</ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                    borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                  }
                ]}
                value={goals[field.key].toString()}
                onChangeText={(value) => updateGoal(field.key, value)}
                placeholder={field.placeholder}
                placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
                keyboardType="numeric"
                returnKeyType="next"
                selectionColor={Colors.primary}
              />
            </View>
          ))}

          <View style={styles.noteContainer}>
            <ThemedText style={styles.noteText}>
              💡 These goals are calculated based on your profile from onboarding. You can adjust them to better fit your personal needs.
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: Colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 30,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  fieldUnit: {
    fontSize: 14,
    opacity: 0.7,
    color: Colors.primary,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  noteContainer: {
    marginTop: 30,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 104, 56, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.2)',
  },
  noteText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
});

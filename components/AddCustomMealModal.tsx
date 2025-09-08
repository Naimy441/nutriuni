import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export interface CustomMealData {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  serving_size: string;
}

interface AddCustomMealModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (mealData: CustomMealData) => void;
}

export function AddCustomMealModal({ visible, onClose, onSave }: AddCustomMealModalProps) {
  const colorScheme = useColorScheme();
  const [isSaving, setIsSaving] = useState(false);
  const [mealData, setMealData] = useState<CustomMealData>({
    name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    serving_size: '1 serving',
  });

  const handleSave = async () => {
    // Validate inputs
    if (!mealData.name.trim()) {
      Alert.alert('Invalid Input', 'Please enter a meal name.');
      return;
    }

    if (mealData.calories <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid calorie amount.');
      return;
    }

    setIsSaving(true);
    try {
      onSave(mealData);
      handleCancel(); // Reset form and close
      Alert.alert('Success', 'Your custom meal has been added!');
    } catch (error) {
      console.error('Error saving custom meal:', error);
      Alert.alert('Error', 'Failed to save your custom meal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setMealData({
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      serving_size: '1 serving',
    });
    onClose();
  };

  const updateField = (key: keyof CustomMealData, value: string) => {
    if (key === 'name' || key === 'serving_size') {
      setMealData(prev => ({ ...prev, [key]: value }));
    } else {
      const numValue = parseFloat(value) || 0;
      setMealData(prev => ({ ...prev, [key]: numValue }));
    }
  };

  const nutritionFields = [
    { key: 'calories' as keyof CustomMealData, label: 'Calories', unit: 'kcal', placeholder: '300', required: true },
    { key: 'protein' as keyof CustomMealData, label: 'Protein', unit: 'g', placeholder: '20' },
    { key: 'carbs' as keyof CustomMealData, label: 'Carbohydrates', unit: 'g', placeholder: '30' },
    { key: 'fat' as keyof CustomMealData, label: 'Fat', unit: 'g', placeholder: '10' },
    { key: 'fiber' as keyof CustomMealData, label: 'Fiber', unit: 'g', placeholder: '5' },
    { key: 'sugar' as keyof CustomMealData, label: 'Sugar', unit: 'g', placeholder: '8' },
    { key: 'sodium' as keyof CustomMealData, label: 'Sodium', unit: 'mg', placeholder: '400' },
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
          <ThemedText type="title" style={styles.title}>Add Custom Meal</ThemedText>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            disabled={isSaving}
          >
            <ThemedText style={styles.saveText}>
              {isSaving ? 'Adding...' : 'Add'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Meal Name */}
          <View style={styles.fieldContainer}>
            <View style={styles.fieldHeader}>
              <ThemedText style={styles.fieldLabel}>Meal Name *</ThemedText>
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
              value={mealData.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="e.g. Homemade Sandwich"
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
              returnKeyType="next"
              selectionColor={Colors.primary}
            />
          </View>

          {/* Serving Size */}
          <View style={styles.fieldContainer}>
            <View style={styles.fieldHeader}>
              <ThemedText style={styles.fieldLabel}>Serving Size</ThemedText>
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
              value={mealData.serving_size}
              onChangeText={(value) => updateField('serving_size', value)}
              placeholder="e.g. 1 sandwich, 200g, 1 cup"
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
              returnKeyType="next"
              selectionColor={Colors.primary}
            />
          </View>

          <ThemedText style={styles.sectionTitle}>Nutrition Information</ThemedText>

          {nutritionFields.map((field) => (
            <View key={field.key} style={styles.fieldContainer}>
              <View style={styles.fieldHeader}>
                <ThemedText style={styles.fieldLabel}>
                  {field.label} {field.required && '*'}
                </ThemedText>
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
                value={mealData[field.key].toString()}
                onChangeText={(value) => updateField(field.key, value)}
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
              💡 Only meal name and calories are required. You can leave other nutrition fields at 0 if unknown.
            </ThemedText>
          </View>

          <View style={styles.tipContainer}>
            <ThemedText style={styles.tipText}>
              🔍 Tip: Use nutrition labels, food apps, or online databases to find accurate nutrition information for your custom meals.
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
  contentContainer: {
    paddingBottom: 50,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 30,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    marginTop: 10,
    textAlign: 'center',
    color: Colors.primary,
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
  tipContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.2)',
  },
  tipText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
});

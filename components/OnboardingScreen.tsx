import { Citations } from '@/components/Citations';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface UserProfile {
  age: number;
  weight: number; // pounds
  heightFeet: number;
  heightInches: number;
  gender: 'male' | 'female';
  activityLevel: number; // 1.2 - 1.9
  goal: 'maintain' | 'lose' | 'gain';
}

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

interface OnboardingScreenProps {
  onComplete: (goals: NutritionGoals) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const colorScheme = useColorScheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  
  // Individual input states
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  
  // Refs for height inputs
  const inchesInputRef = useRef<TextInput>(null);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(1))[0];
  const slideAnim = useState(new Animated.Value(0))[0];

  const calculateBMR = (profile: UserProfile): number => {
    // Convert pounds to kg and feet/inches to cm
    const weightKg = profile.weight * 0.453592;
    const heightCm = (profile.heightFeet * 12 + profile.heightInches) * 2.54;
    
    // Mifflin-St Jeor Equation - widely accepted method for calculating Basal Metabolic Rate
    // Source: American Journal of Clinical Nutrition, used by healthcare professionals
    if (profile.gender === 'male') {
      return 10 * weightKg + 6.25 * heightCm - 5 * profile.age + 5;
    } else {
      return 10 * weightKg + 6.25 * heightCm - 5 * profile.age - 161;
    }
  };

  const calculateTDEE = (profile: UserProfile): number => {
    const bmr = calculateBMR(profile);
    return bmr * profile.activityLevel;
  };

  const calculateNutritionGoals = (profile: UserProfile): NutritionGoals => {
    let tdee = calculateTDEE(profile);
    
    // Adjust calories for weight management goals based on safe weight loss/gain principles
    if (profile.goal === 'lose') {
      tdee -= 500; // 500 cal deficit for ~1 lb/week loss (CDC recommended safe rate)
    } else if (profile.goal === 'gain') {
      tdee += 300; // 300 cal surplus for gradual gain (avoiding excessive fat gain)
    }

    const calories = Math.round(tdee);
    
    // Calculate macronutrients following Dietary Guidelines for Americans
    const weightKg = profile.weight * 0.453592;
    
    // Protein: 1.6g/kg for active individuals (within AMDR of 10-35% calories)
    // Source: Dietary Guidelines for Americans, International Society of Sports Nutrition
    const proteinGrams = Math.round(weightKg * 1.6);
    const proteinCals = proteinGrams * 4; // 4 calories per gram of protein
    
    // Fat: 28% of total calories (within AMDR of 20-35% calories)
    // Source: Dietary Guidelines for Americans AMDR recommendations
    const fatPercent = 0.28;
    const fatCals = calories * fatPercent;
    const fatGrams = Math.round(fatCals / 9); // 9 calories per gram of fat
    
    // Carbohydrates: Remaining calories (ensures within AMDR of 45-65% calories)
    const remainingCals = calories - proteinCals - fatCals;
    const carbGrams = Math.round(remainingCals / 4); // 4 calories per gram of carbohydrates
    
    // Fiber: 14g per 1000 calories (FDA/USDA Dietary Guidelines recommendation)
    const fiber = Math.round((calories / 1000) * 14);
    
    // Added Sugar: Daily limits based on American Heart Association guidelines
    // Males: 36g max, Females: 25g max per day
    const sugar = profile.gender === 'male' ? 36 : 25;

    return {
      calories,
      protein: proteinGrams,
      carbs: carbGrams,
      fat: fatGrams,
      fiber,
      sugar,
    };
  };

  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const validateAndNext = () => {
    const value = getCurrentValue();
    const validation = validateCurrentStep(value);
    
    if (!validation.isValid) {
      Alert.alert('Invalid Input', validation.message);
      return;
    }

    // Save current step data
    saveCurrentStepData(value);
    
    // Animate to next step
    if (currentStep < 6) {
      animateTransition(() => {
        setCurrentStep(prev => prev + 1);
      });
    } else {
      handleComplete();
    }
  };

  const getCurrentValue = (): any => {
    switch (currentStep) {
      case 0: return null; // Welcome screen
      case 1: return age;
      case 2: return weight;
      case 3: return { feet: heightFeet, inches: heightInches };
      case 4: return profile.gender;
      case 5: return profile.activityLevel;
      case 6: return profile.goal;
      default: return null;
    }
  };

  const validateCurrentStep = (value: any): { isValid: boolean; message: string } => {
    switch (currentStep) {
      case 0:
        // Welcome screen - no validation needed
        return { isValid: true, message: '' };
      
      case 1:
        const ageNum = parseInt(value);
        if (!ageNum || ageNum < 13 || ageNum > 100) {
          return { isValid: false, message: 'Please enter an age between 13 and 100.' };
        }
        return { isValid: true, message: '' };
      
      case 2:
        const weightNum = parseFloat(value);
        if (!weightNum || weightNum < 70 || weightNum > 600) {
          return { isValid: false, message: 'Please enter a weight between 70 and 600 pounds.' };
        }
        return { isValid: true, message: '' };
      
      case 3:
        const feetNum = parseInt(value.feet);
        const inchesNum = parseInt(value.inches || '0');
        if (!feetNum || feetNum < 4 || feetNum > 7) {
          return { isValid: false, message: 'Please enter feet between 4 and 7.' };
        }
        if (inchesNum < 0 || inchesNum > 11) {
          return { isValid: false, message: 'Please enter inches between 0 and 11.' };
        }
        return { isValid: true, message: '' };
      
      case 4:
      case 5:
      case 6:
        if (!value) {
          return { isValid: false, message: 'Please make a selection.' };
        }
        return { isValid: true, message: '' };
      
      default:
        return { isValid: true, message: '' };
    }
  };

  const saveCurrentStepData = (value: any) => {
    switch (currentStep) {
      case 0:
        // Welcome screen - no data to save
        break;
      case 1:
        setProfile(prev => ({ ...prev, age: parseInt(value) }));
        break;
      case 2:
        setProfile(prev => ({ ...prev, weight: parseFloat(value) }));
        break;
      case 3:
        setProfile(prev => ({ 
          ...prev, 
          heightFeet: parseInt(value.feet), 
          heightInches: parseInt(value.inches || '0') 
        }));
        break;
    }
  };

  const handleComplete = async () => {
    if (!profile.gender || !profile.activityLevel || !profile.goal) {
      Alert.alert('Incomplete', 'Please complete all fields.');
      return;
    }

    const completeProfile = profile as UserProfile;
    const goals = calculateNutritionGoals(completeProfile);
    
    try {
      // Save profile and goals
      await AsyncStorage.setItem('user_profile', JSON.stringify(completeProfile));
      await AsyncStorage.setItem('nutrition_goals', JSON.stringify(goals));
      await AsyncStorage.setItem('onboarding_complete', 'true');
      
      onComplete(goals);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    }
  };

  const getStepData = () => {
    const steps = [
      {
        question: "Welcome to nutriuni!",
        subtitle: "Your personal nutrition companion for dining",
        type: 'welcome',
        description: "We'll help you track your nutrition goals and make informed dining choices across Duke's campus restaurants. To get started, we need to learn a bit about you to calculate personalized nutrition targets.",
      },
      {
        question: "What's your age?",
        subtitle: "We use this to calculate your metabolism",
        type: 'input',
        placeholder: 'e.g. 20',
        keyboardType: 'numeric' as const,
        value: age,
        setValue: setAge,
      },
      {
        question: "What's your weight?",
        subtitle: "In pounds",
        type: 'input',
        placeholder: 'e.g. 150',
        keyboardType: 'numeric' as const,
        value: weight,
        setValue: setWeight,
      },
      {
        question: "How tall are you?",
        subtitle: "Enter feet and inches",
        type: 'height',
        feetValue: heightFeet,
        inchesValue: heightInches,
        setFeetValue: setHeightFeet,
        setInchesValue: setHeightInches,
      },
      {
        question: "What's your gender?",
        subtitle: "This affects your metabolism calculation",
        type: 'options',
        options: [
          { value: 'male', label: 'Male', desc: '' },
          { value: 'female', label: 'Female', desc: '' },
        ],
      },
      {
        question: "How active are you?",
        subtitle: "Choose what best describes you",
        type: 'options',
        options: [
          { value: 1.2, label: 'Sedentary', desc: 'Little to no exercise' },
          { value: 1.375, label: 'Light', desc: 'Light exercise 1-3 days/week' },
          { value: 1.55, label: 'Moderate', desc: 'Moderate exercise 3-5 days/week' },
          { value: 1.725, label: 'Active', desc: 'Heavy exercise 6-7 days/week' },
          { value: 1.9, label: 'Very Active', desc: 'Very heavy exercise, physical job' },
        ],
      },
      {
        question: "What's your goal?",
        subtitle: "What would you like to achieve?",
        type: 'options',
        options: [
          { value: 'lose', label: 'Lose Weight', desc: 'Gradual weight loss' },
          { value: 'maintain', label: 'Maintain Weight', desc: 'Keep current weight' },
          { value: 'gain', label: 'Gain Weight', desc: 'Gradual weight gain' },
        ],
      },
    ];
    
    return steps[currentStep];
  };

  const renderContent = () => {
    const stepData = getStepData();
    
    return (
      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <View style={styles.questionContainer}>
          <ThemedText type="title" style={styles.question}>
            {stepData.question}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {stepData.subtitle}
          </ThemedText>
        </View>

        {stepData.type === 'welcome' ? (
          <ScrollView 
            style={styles.welcomeScrollContainer}
            contentContainerStyle={styles.welcomeContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/images/nutriuni.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <ThemedText style={styles.welcomeDescription}>
              {stepData.description}
            </ThemedText>
            
            {/* Medical Information Citations */}
            <Citations type="all" style={styles.welcomeCitations} />
            
            <View style={styles.calculationNote}>
              <ThemedText style={styles.calculationNoteText}>
                Our personalized nutrition calculations are based on established medical formulas including the Mifflin-St Jeor equation for metabolism and USDA Dietary Guidelines for Americans for macronutrient distribution.
              </ThemedText>
            </View>
          </ScrollView>
        ) : stepData.type === 'input' ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                borderWidth: 2,
                borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
              }]}
              value={stepData.value}
              onChangeText={stepData.setValue}
              placeholder={stepData.placeholder}
              placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
              keyboardType={stepData.keyboardType}
              autoFocus
              selectionColor={Colors.primary}
              cursorColor={Colors.primary}
              returnKeyType="next"
              onSubmitEditing={validateAndNext}
              blurOnSubmit={false}
            />
          </View>
        ) : stepData.type === 'height' ? (
          <View style={styles.heightContainer}>
            <View style={styles.heightInputRow}>
              <View style={styles.heightInputGroup}>
                <TextInput
                  style={[styles.heightInput, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                    borderWidth: 2,
                    borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                  }]}
                  value={stepData.feetValue}
                  onChangeText={(text) => {
                    stepData.setFeetValue?.(text);
                    // Auto-focus inches input when a valid number is entered
                    if (text && !isNaN(Number(text)) && text.length >= 1) {
                      setTimeout(() => {
                        inchesInputRef.current?.focus();
                      }, 100);
                    }
                  }}
                  placeholder="e.g. 5"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
                  keyboardType="numeric"
                  autoFocus
                  selectionColor={Colors.primary}
                  cursorColor={Colors.primary}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    inchesInputRef.current?.focus();
                  }}
                  blurOnSubmit={false}
                />
                <ThemedText style={styles.heightLabel}>feet</ThemedText>
              </View>
              <View style={styles.heightInputGroup}>
                <TextInput
                  ref={inchesInputRef}
                  style={[styles.heightInput, { 
                    backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                    borderWidth: 2,
                    borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                  }]}
                  value={stepData.inchesValue}
                  onChangeText={stepData.setInchesValue}
                  placeholder="e.g. 8"
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
                  keyboardType="numeric"
                  selectionColor={Colors.primary}
                  cursorColor={Colors.primary}
                  returnKeyType="next"
                  onSubmitEditing={validateAndNext}
                  blurOnSubmit={false}
                />
                <ThemedText style={styles.heightLabel}>inches</ThemedText>
              </View>
            </View>
          </View>
        ) : (
          <ScrollView 
            style={styles.optionsContainer}
            contentContainerStyle={styles.optionsContent}
            showsVerticalScrollIndicator={false}
          >
            {stepData.options?.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  getCurrentValue() === option.value && styles.optionButtonSelected
                ]}
                onPress={() => {
                  if (currentStep === 4) {
                    setProfile(prev => ({ ...prev, gender: option.value as 'male' | 'female' }));
                  } else if (currentStep === 5) {
                    setProfile(prev => ({ ...prev, activityLevel: option.value as number }));
                  } else if (currentStep === 6) {
                    setProfile(prev => ({ ...prev, goal: option.value as 'maintain' | 'lose' | 'gain' }));
                  }
                }}
              >
                <ThemedText style={[
                  styles.optionText,
                  getCurrentValue() === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </ThemedText>
                {option.desc && option.desc.length > 0 && (
                  <ThemedText style={[
                    styles.optionDesc,
                    getCurrentValue() === option.value && styles.optionDescSelected
                  ]}>
                    {option.desc}
                  </ThemedText>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View 
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${((currentStep + 1) / 7) * 100}%`,
                    }
                  ]}
                />
              </View>
              <ThemedText style={styles.stepCounter}>
                {currentStep + 1} of 7
              </ThemedText>
            </View>
          </View>

          <View style={styles.mainContent}>
            {renderContent()}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.nextButton} 
              onPress={validateAndNext}
            >
              <ThemedText style={styles.nextButtonText}>
                {currentStep === 6 ? 'Complete Setup' : currentStep === 0 ? 'Get Started' : 'Continue'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBarBackground: {
    width: '60%',
    height: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  contentContainer: {
    alignItems: 'center',
  },
  questionContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  question: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  input: {
    width: '80%',
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 24,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '600',
  },
  optionsContainer: {
    width: '100%',
    maxHeight: 400,
  },
  optionsContent: {
    gap: 12,
    paddingBottom: 20,
  },
  optionButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(128, 128, 128, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  optionTextSelected: {
    color: Colors.primary,
  },
  optionDesc: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  optionDescSelected: {
    opacity: 1,
    color: Colors.primary,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heightContainer: {
    width: '100%',
    alignItems: 'center',
  },
  heightInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
  },
  heightInputGroup: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 120,
  },
  heightInput: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 20,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  heightLabel: {
    fontSize: 16,
    opacity: 0.7,
    fontWeight: '500',
  },
  welcomeScrollContainer: {
    flex: 1,
    width: '100%',
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  welcomeDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 40,
  },
  featuresContainer: {
    width: '100%',
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 104, 56, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.2)',
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  welcomeCitations: {
    marginTop: 20,
    width: '100%',
  },
  calculationNote: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 104, 56, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.2)',
    width: '100%',
  },
  calculationNoteText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.9,
    fontStyle: 'italic',
  },
});

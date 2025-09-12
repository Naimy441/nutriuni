import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface CitationsProps {
  type: 'calories' | 'macronutrients' | 'nutrients' | 'all';
  style?: any;
}

interface Citation {
  term: string;
  definition: string;
  source: string;
  url: string;
}

const CITATIONS: Citation[] = [
  {
    term: 'Calorie',
    definition: 'A unit of energy. In nutrition, a calorie (kcal) is the amount of energy needed to raise the temperature of one kilogram of water by one degree Celsius. It measures the energy content in food and beverages.',
    source: 'U.S. Food and Drug Administration (FDA)',
    url: 'https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label'
  },
  {
    term: 'Mifflin-St Jeor Equation',
    definition: 'A widely accepted formula for calculating Basal Metabolic Rate (BMR). For males: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5. For females: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161. This is then multiplied by activity level to determine Total Daily Energy Expenditure (TDEE).',
    source: 'American Journal of Clinical Nutrition - Widely used in healthcare and nutrition science',
    url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/'
  },
  {
    term: 'AMDR (Acceptable Macronutrient Distribution Ranges)',
    definition: 'Evidence-based ranges for macronutrient intake: Carbohydrates 45-65% of calories, Protein 10-35% of calories, Fat 20-35% of calories. Our calculations use Protein at 1.6g/kg body weight (for active individuals), Fat at 28% of calories, and Carbohydrates for remaining calories.',
    source: 'U.S. Department of Health and Human Services - Dietary Guidelines for Americans',
    url: 'https://www.dietaryguidelines.gov/sites/default/files/2021-03/Dietary_Guidelines_for_Americans-2020-2025.pdf'
  },
  {
    term: 'Protein',
    definition: 'An essential macronutrient made up of amino acids that are necessary for building and repairing tissues, making enzymes and hormones, and supporting immune function.',
    source: 'U.S. Department of Health and Human Services - Dietary Guidelines for Americans',
    url: 'https://www.dietaryguidelines.gov/sites/default/files/2021-03/Dietary_Guidelines_for_Americans-2020-2025.pdf'
  },
  {
    term: 'Carbohydrates',
    definition: 'The body\'s main source of energy. Carbohydrates are broken down into glucose (blood sugar) which is used by the body\'s cells for energy. Found in grains, fruits, vegetables, and dairy products.',
    source: 'U.S. Department of Health and Human Services - Dietary Guidelines for Americans',
    url: 'https://www.dietaryguidelines.gov/sites/default/files/2021-03/Dietary_Guidelines_for_Americans-2020-2025.pdf'
  },
  {
    term: 'Fat',
    definition: 'An essential macronutrient that provides energy, helps absorb fat-soluble vitamins (A, D, E, K), and is important for brain function and cell structure. Includes saturated, unsaturated, and trans fats.',
    source: 'U.S. Department of Health and Human Services - Dietary Guidelines for Americans',
    url: 'https://www.dietaryguidelines.gov/sites/default/files/2021-03/Dietary_Guidelines_for_Americans-2020-2025.pdf'
  },
  {
    term: 'Dietary Fiber',
    definition: 'The indigestible part of plant foods that helps maintain digestive health, may help lower cholesterol levels, and can help control blood sugar levels.',
    source: 'National Institutes of Health (NIH) - MedlinePlus',
    url: 'https://medlineplus.gov/dietaryfiber.html'
  },
  {
    term: 'Sugar',
    definition: 'A type of carbohydrate that provides energy. Includes naturally occurring sugars (in fruits and milk) and added sugars (added during processing or preparation).',
    source: 'U.S. Food and Drug Administration (FDA)',
    url: 'https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label'
  },
  {
    term: 'Sodium',
    definition: 'An essential mineral that helps maintain fluid balance and is necessary for muscle and nerve function. However, too much sodium can contribute to high blood pressure.',
    source: 'National Institutes of Health (NIH) - MedlinePlus',
    url: 'https://medlineplus.gov/sodium.html'
  },
  {
    term: 'Nutritional Data Source',
    definition: 'All nutritional labels and food information for Duke University restaurant items are provided by Duke NetNutrition, the official nutrition management system used by Duke Dining Services to ensure accurate and up-to-date nutritional information.',
    source: 'Duke University NetNutrition System',
    url: 'https://netnutrition.cbord.com/nn-prod/Duke#'
  }
];

export function Citations({ type, style }: CitationsProps) {
  const [expanded, setExpanded] = useState(false);

  const getRelevantCitations = (): Citation[] => {
    switch (type) {
      case 'calories':
        return CITATIONS.filter(c => ['Calorie', 'Mifflin-St Jeor Equation', 'Nutritional Data Source'].includes(c.term));
      case 'macronutrients':
        return CITATIONS.filter(c => ['Protein', 'Carbohydrates', 'Fat', 'AMDR (Acceptable Macronutrient Distribution Ranges)', 'Nutritional Data Source'].includes(c.term));
      case 'nutrients':
        return CITATIONS.filter(c => ['Dietary Fiber', 'Sugar', 'Sodium', 'Nutritional Data Source'].includes(c.term));
      case 'all':
      default:
        return CITATIONS;
    }
  };

  const citations = getRelevantCitations();

  const handleLinkPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  return (
    <ThemedView style={[styles.container, style]}>
      <TouchableOpacity 
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <ThemedText style={styles.headerText}>Medical Information Sources</ThemedText>
        </View>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={16} 
          color={Colors.primary} 
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <ThemedText style={styles.disclaimer}>
            The following definitions are provided by official U.S. government health agencies:
          </ThemedText>
          
          {citations.map((citation, index) => (
            <View key={index} style={styles.citationItem}>
              <ThemedText style={styles.term}>{citation.term}:</ThemedText>
              <ThemedText style={styles.definition}>{citation.definition}</ThemedText>
              <TouchableOpacity 
                onPress={() => handleLinkPress(citation.url)}
                style={styles.sourceLink}
              >
                <ThemedText style={styles.source}>
                  Source: {citation.source} <Ionicons name="open-outline" size={12} color={Colors.primary} />
                </ThemedText>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.generalDisclaimer}>
            <ThemedText style={styles.disclaimerText}>
              This app provides nutritional information for educational purposes only. 
              Always consult with a healthcare provider for personalized dietary advice.
            </ThemedText>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    backgroundColor: 'rgba(0, 104, 56, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 104, 56, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  content: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  disclaimer: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 16,
  },
  citationItem: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  term: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: Colors.primary,
  },
  definition: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
    opacity: 0.9,
  },
  sourceLink: {
    alignSelf: 'flex-start',
  },
  source: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.primary,
    textDecorationLine: 'underline',
    lineHeight: 16,
  },
  generalDisclaimer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 6,
  },
  disclaimerText: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 16,
  },
});

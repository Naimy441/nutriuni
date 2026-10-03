// Health and nutrition references shown on the Sources & methods screen
// (App Store guideline 1.4.1 asks health apps to cite their sources).

export interface Citation {
  term: string;
  definition: string;
  source: string;
  url: string;
}

export const CITATIONS: Citation[] = [
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

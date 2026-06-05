import type { NutrientKey } from '../../types/recipe'

export type FdcNutrientMapping = {
  nutrientId: number
  key: NutrientKey
  factor?: number
  combine?: boolean
}

// FDC values are per 100 g. The app stores nutrientProfile values per 100 g.
// Mineral units are normalized to the NutrientKey units used in nutrientKeys.ts.
export const FDC_NUTRIENT_MAP: readonly FdcNutrientMapping[] = [
  { nutrientId: 1003, key: 'crudeProtein' },
  { nutrientId: 1004, key: 'crudeFat' },
  { nutrientId: 1079, key: 'crudeFiber' }, // closest FDC field: total dietary fiber
  { nutrientId: 1007, key: 'ash' },
  { nutrientId: 1051, key: 'moisture' },

  { nutrientId: 1220, key: 'arginine' },
  { nutrientId: 1221, key: 'histidine' },
  { nutrientId: 1212, key: 'isoleucine' },
  { nutrientId: 1213, key: 'leucine' },
  { nutrientId: 1214, key: 'lysine' },
  { nutrientId: 1215, key: 'methionine' },
  { nutrientId: 1215, key: 'methionineCystine', combine: true },
  { nutrientId: 1216, key: 'methionineCystine', combine: true },
  { nutrientId: 1217, key: 'phenylalanine' },
  { nutrientId: 1217, key: 'phenylalanineTyrosine', combine: true },
  { nutrientId: 1218, key: 'phenylalanineTyrosine', combine: true },
  { nutrientId: 1211, key: 'threonine' },
  { nutrientId: 1210, key: 'tryptophan' },
  { nutrientId: 1219, key: 'valine' },

  { nutrientId: 1316, key: 'linoleicAcid' },
  { nutrientId: 1269, key: 'linoleicAcid' },
  { nutrientId: 1271, key: 'arachidonicAcid', factor: 1000 },
  { nutrientId: 1404, key: 'alphaLinolenicAcid' },
  { nutrientId: 1278, key: 'epaDha', combine: true },
  { nutrientId: 1272, key: 'epaDha', combine: true },

  { nutrientId: 1087, key: 'calcium', factor: 0.001 },
  { nutrientId: 1091, key: 'phosphorus', factor: 0.001 },
  { nutrientId: 1092, key: 'potassium', factor: 0.001 },
  { nutrientId: 1093, key: 'sodium', factor: 0.001 },
  { nutrientId: 1094, key: 'chloride', factor: 0.001 },
  { nutrientId: 1090, key: 'magnesium', factor: 0.001 },
  { nutrientId: 1098, key: 'copper' },
  { nutrientId: 1100, key: 'iodine', factor: 0.001 },
  { nutrientId: 1089, key: 'iron' },
  { nutrientId: 1101, key: 'manganese' },
  { nutrientId: 1103, key: 'selenium' },
  { nutrientId: 1095, key: 'zinc' },

  { nutrientId: 1104, key: 'vitaminA' },
  { nutrientId: 1110, key: 'vitaminD' },
  { nutrientId: 1109, key: 'vitaminE', factor: 1.49 },
  { nutrientId: 1165, key: 'vitaminB1' },
  { nutrientId: 1166, key: 'vitaminB2' },
  { nutrientId: 1167, key: 'vitaminB3' },
  { nutrientId: 1170, key: 'vitaminB5' },
  { nutrientId: 1175, key: 'vitaminB6' },
  { nutrientId: 1176, key: 'vitaminB7' },
  { nutrientId: 1177, key: 'vitaminB9' },
  { nutrientId: 1178, key: 'vitaminB12' },
  { nutrientId: 1180, key: 'choline' },
  { nutrientId: 1185, key: 'vitaminK', combine: true },
  { nutrientId: 1184, key: 'vitaminK', combine: true },
]

export const FDC_MAPPED_NUTRIENT_IDS = [
  ...new Set(FDC_NUTRIENT_MAP.map((mapping) => mapping.nutrientId)),
].sort((a, b) => a - b)

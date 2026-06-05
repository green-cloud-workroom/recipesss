import type { NutrientKey } from '../../types/recipe'

// 영양소 키 메타데이터 (단계 1-A, DL-032).
// 매트릭스 표시·정렬·라벨용 순수 데이터. 단위는 FEDIAF 표 UNIT 컬럼 기준
// (per-1000kcal·per-100g-DM 공통). 순수 — React/Firebase 의존 없음.

export type NutrientCategory =
  | 'general'
  | 'amino'
  | 'fatty'
  | 'mineral'
  | 'vitamin'

export type NutrientUnit = 'g' | 'mg' | 'µg' | 'IU'

export type NutrientMeta = {
  key: NutrientKey
  label: string // 한글 표시명
  unit: NutrientUnit
  category: NutrientCategory
  order: number // 표시 순서 (FEDIAF 표 순서)
}

export const NUTRIENT_META: readonly NutrientMeta[] = [
  // 일반성분
  { key: 'crudeProtein', label: '조단백', unit: 'g', category: 'general', order: 10 },
  { key: 'crudeFat', label: '조지방', unit: 'g', category: 'general', order: 11 },
  { key: 'crudeFiber', label: '조섬유', unit: 'g', category: 'general', order: 12 },
  { key: 'ash', label: '조회분', unit: 'g', category: 'general', order: 13 },
  { key: 'moisture', label: '수분', unit: 'g', category: 'general', order: 14 },
  { key: 'nfe', label: '가용무질소물(NFE)', unit: 'g', category: 'general', order: 15 },
  // 아미노산
  { key: 'arginine', label: '아르기닌', unit: 'g', category: 'amino', order: 20 },
  { key: 'histidine', label: '히스티딘', unit: 'g', category: 'amino', order: 21 },
  { key: 'isoleucine', label: '이소류신', unit: 'g', category: 'amino', order: 22 },
  { key: 'leucine', label: '류신', unit: 'g', category: 'amino', order: 23 },
  { key: 'lysine', label: '라이신', unit: 'g', category: 'amino', order: 24 },
  { key: 'methionine', label: '메티오닌', unit: 'g', category: 'amino', order: 25 },
  {
    key: 'methionineCystine',
    label: '메티오닌+시스틴',
    unit: 'g',
    category: 'amino',
    order: 26,
  },
  { key: 'phenylalanine', label: '페닐알라닌', unit: 'g', category: 'amino', order: 27 },
  {
    key: 'phenylalanineTyrosine',
    label: '페닐알라닌+티로신',
    unit: 'g',
    category: 'amino',
    order: 28,
  },
  { key: 'threonine', label: '트레오닌', unit: 'g', category: 'amino', order: 29 },
  { key: 'tryptophan', label: '트립토판', unit: 'g', category: 'amino', order: 30 },
  { key: 'valine', label: '발린', unit: 'g', category: 'amino', order: 31 },
  { key: 'taurine', label: '타우린', unit: 'g', category: 'amino', order: 32 },
  // 지방산
  {
    key: 'linoleicAcid',
    label: '리놀레산 (ω-6)',
    unit: 'g',
    category: 'fatty',
    order: 40,
  },
  {
    key: 'arachidonicAcid',
    label: '아라키돈산 (ω-6)',
    unit: 'mg',
    category: 'fatty',
    order: 41,
  },
  {
    key: 'alphaLinolenicAcid',
    label: '알파리놀렌산 (ω-3)',
    unit: 'g',
    category: 'fatty',
    order: 42,
  },
  { key: 'epaDha', label: 'EPA+DHA (ω-3)', unit: 'g', category: 'fatty', order: 43 },
  // 미네랄
  { key: 'calcium', label: '칼슘', unit: 'g', category: 'mineral', order: 50 },
  { key: 'phosphorus', label: '인', unit: 'g', category: 'mineral', order: 51 },
  { key: 'potassium', label: '칼륨', unit: 'g', category: 'mineral', order: 52 },
  { key: 'sodium', label: '나트륨', unit: 'g', category: 'mineral', order: 53 },
  { key: 'chloride', label: '염소', unit: 'g', category: 'mineral', order: 54 },
  { key: 'magnesium', label: '마그네슘', unit: 'g', category: 'mineral', order: 55 },
  { key: 'copper', label: '구리', unit: 'mg', category: 'mineral', order: 56 },
  { key: 'iodine', label: '요오드', unit: 'mg', category: 'mineral', order: 57 },
  { key: 'iron', label: '철', unit: 'mg', category: 'mineral', order: 58 },
  { key: 'manganese', label: '망간', unit: 'mg', category: 'mineral', order: 59 },
  { key: 'selenium', label: '셀레늄', unit: 'µg', category: 'mineral', order: 60 },
  { key: 'zinc', label: '아연', unit: 'mg', category: 'mineral', order: 61 },
  // 비타민
  { key: 'vitaminA', label: '비타민 A', unit: 'IU', category: 'vitamin', order: 70 },
  { key: 'vitaminD', label: '비타민 D', unit: 'IU', category: 'vitamin', order: 71 },
  { key: 'vitaminE', label: '비타민 E', unit: 'IU', category: 'vitamin', order: 72 },
  {
    key: 'vitaminB1',
    label: '비타민 B1 (티아민)',
    unit: 'mg',
    category: 'vitamin',
    order: 73,
  },
  {
    key: 'vitaminB2',
    label: '비타민 B2 (리보플라빈)',
    unit: 'mg',
    category: 'vitamin',
    order: 74,
  },
  {
    key: 'vitaminB3',
    label: '비타민 B3 (나이아신)',
    unit: 'mg',
    category: 'vitamin',
    order: 75,
  },
  {
    key: 'vitaminB5',
    label: '비타민 B5 (판토텐산)',
    unit: 'mg',
    category: 'vitamin',
    order: 76,
  },
  {
    key: 'vitaminB6',
    label: '비타민 B6 (피리독신)',
    unit: 'mg',
    category: 'vitamin',
    order: 77,
  },
  {
    key: 'vitaminB7',
    label: '비타민 B7 (비오틴)',
    unit: 'µg',
    category: 'vitamin',
    order: 78,
  },
  {
    key: 'vitaminB9',
    label: '비타민 B9 (엽산)',
    unit: 'µg',
    category: 'vitamin',
    order: 79,
  },
  {
    key: 'vitaminB12',
    label: '비타민 B12 (코발라민)',
    unit: 'µg',
    category: 'vitamin',
    order: 80,
  },
  { key: 'choline', label: '콜린', unit: 'mg', category: 'vitamin', order: 81 },
  { key: 'vitaminK', label: '비타민 K', unit: 'µg', category: 'vitamin', order: 82 },
]

const META_BY_KEY: Record<NutrientKey, NutrientMeta> = Object.fromEntries(
  NUTRIENT_META.map((meta) => [meta.key, meta]),
) as Record<NutrientKey, NutrientMeta>

export function nutrientMeta(key: NutrientKey): NutrientMeta {
  return META_BY_KEY[key]
}

export const CATEGORY_LABELS: Record<NutrientCategory, string> = {
  general: '일반성분',
  amino: '아미노산',
  fatty: '지방산',
  mineral: '미네랄',
  vitamin: '비타민',
}

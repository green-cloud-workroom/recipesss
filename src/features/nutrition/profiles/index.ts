import type { NutrientProfile, Species } from '../../../types/recipe'
import { AAFCO_PROFILES } from './aafco'
import { FEDIAF_2025_PROFILES } from './fediaf2025'

// 영양 표준 정적 레지스트리 (단계 1-A, DL-032).
// 표준은 불변 참조 데이터라 앱 번들로 둔다 (Firestore 미사용).
// 다표준 동등 지원: FEDIAF 2025 + AAFCO 2014. (NRC 등 추가 시 여기서 합침.)

export const ALL_PROFILES: readonly NutrientProfile[] = [
  ...FEDIAF_2025_PROFILES,
  ...AAFCO_PROFILES,
]

const BY_ID = new Map(ALL_PROFILES.map((profile) => [profile.id, profile]))

export function getProfile(id: string): NutrientProfile | undefined {
  return BY_ID.get(id)
}

export function profilesForSpecies(
  species: Exclude<Species, null>,
): NutrientProfile[] {
  return ALL_PROFILES.filter((profile) => profile.species === species)
}

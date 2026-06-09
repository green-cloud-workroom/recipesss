import type { NutrientProfile, Species } from '../../../types/recipe'
import { AAFCO_PROFILES } from './aafco'
import { FEDIAF_2025_PROFILES } from './fediaf2025'
import { NRC_2006_PROFILES } from './nrc2006'

// 영양 표준 정적 레지스트리 (단계 1-A, DL-032).
// 표준은 불변 참조 데이터라 앱 번들로 둔다 (Firestore 미사용).
// 다표준 동등 지원: FEDIAF 2025 (7) + AAFCO 2014 (4) + NRC 2006 (2).

export const ALL_PROFILES: readonly NutrientProfile[] = [
  ...FEDIAF_2025_PROFILES,
  ...AAFCO_PROFILES,
  ...NRC_2006_PROFILES,
]

const BY_ID = new Map(ALL_PROFILES.map((profile) => [profile.id, profile]))

const PROFILE_ID_ALIASES: Record<string, string> = {
  AAFCO_2024_CAT_ADULT: 'AAFCO_2014_CAT_ADULT',
  AAFCO_2024_DOG_ADULT: 'AAFCO_2014_DOG_ADULT',
}

export function resolveProfileId(id: string): string {
  return PROFILE_ID_ALIASES[id] ?? id
}

export function getProfile(id: string): NutrientProfile | undefined {
  return BY_ID.get(resolveProfileId(id))
}

export function profilesForSpecies(
  species: Exclude<Species, null>,
): NutrientProfile[] {
  return ALL_PROFILES.filter((profile) => profile.species === species)
}

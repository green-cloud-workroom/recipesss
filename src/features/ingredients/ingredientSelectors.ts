import type { Ingredient, NutrientValues } from '../../types/recipe'

export type IngredientGroups = {
  ingredient: Ingredient[]
  supplement: Ingredient[]
}

export function filterIngredients(
  items: Ingredient[],
  search: string,
): Ingredient[] {
  const query = search.trim().toLowerCase()
  if (!query) return [...items]

  return items.filter((item) => {
    const haystack = [
      item.name,
      item.displayName,
      ...item.aliases,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

export function groupByKind(items: Ingredient[]): IngredientGroups {
  const groups: IngredientGroups = { ingredient: [], supplement: [] }

  for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    groups[item.kind].push(item)
  }

  return groups
}

export function filledNutrientCount(
  profile: NutrientValues | undefined,
): number {
  if (!profile) return 0
  return Object.values(profile).filter((value) => value !== undefined).length
}

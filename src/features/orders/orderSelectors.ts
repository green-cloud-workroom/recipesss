import type { Preset, RecipeDraft, Species } from '../../types/recipe'

export type OrderGroup = {
  draftId: string
  draftName: string
  species: Species
  unitLabel: string
  presets: Preset[]
}

export type OrderSelection = Record<string, true>

export type OrderSummaryItem = { code: string }
export type OrderSummaryGroup = {
  draftId: string
  label: string
  items: OrderSummaryItem[]
}

export function speciesLabel(species: Species): string {
  if (species === 'cat') return '고양이'
  if (species === 'dog') return '강아지'
  return '미지정'
}

export function groupLabel(draft: RecipeDraft): string {
  return `(${speciesLabel(draft.species)})${draft.name}`
}

export function groupPresetsByRecipe(
  drafts: RecipeDraft[],
  presets: Preset[],
): OrderGroup[] {
  const presetsByDraft = new Map<string, Preset[]>()

  for (const preset of presets) {
    const list = presetsByDraft.get(preset.draftId) ?? []
    list.push(preset)
    presetsByDraft.set(preset.draftId, list)
  }

  return [...drafts]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((draft) => {
      const draftPresets = presetsByDraft.get(draft.id)
      if (!draftPresets || draftPresets.length === 0) return []

      return [
        {
          draftId: draft.id,
          draftName: draft.name,
          species: draft.species,
          unitLabel: draft.unitLabel,
          presets: [...draftPresets].sort((a, b) => a.sortOrder - b.sortOrder),
        },
      ]
    })
}

export function buildOrderSummary(
  groups: OrderGroup[],
  selection: OrderSelection,
): OrderSummaryGroup[] {
  return groups.flatMap((group) => {
    const items = group.presets.flatMap((preset) => {
      if (!Object.prototype.hasOwnProperty.call(selection, preset.id)) return []

      return [
        {
          code: preset.code,
        },
      ]
    })

    if (items.length === 0) return []

    return [
      {
        draftId: group.draftId,
        label: `(${speciesLabel(group.species)})${group.draftName}`,
        items,
      },
    ]
  })
}

export function formatOrderLine(group: OrderSummaryGroup): string {
  const body = group.items.map((item) => item.code).join(' / ')

  return `${group.label}  ${body}`
}

export function totalSelectedCount(selection: OrderSelection): number {
  return Object.keys(selection).length
}

import type { Preset } from '../../types/recipe'

export function selectPresetsByDraft(
  presets: Preset[],
  draftId: string,
): Preset[] {
  return presets
    .filter((preset) => preset.draftId === draftId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function nextSortOrder(presets: Preset[], draftId: string): number {
  const inDraft = presets.filter((preset) => preset.draftId === draftId)
  if (inDraft.length === 0) return 0
  return Math.max(...inDraft.map((preset) => preset.sortOrder)) + 1
}

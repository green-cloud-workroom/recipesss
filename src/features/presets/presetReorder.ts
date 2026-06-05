import type { Preset } from '../../types/recipe'

export function reorderPresets(
  draftPresets: Preset[],
  activeId: string,
  overId: string,
): Preset[] {
  const from = draftPresets.findIndex((preset) => preset.id === activeId)
  const to = draftPresets.findIndex((preset) => preset.id === overId)

  if (from === -1 || to === -1 || from === to) return []

  const next = [...draftPresets]
  const moved = next[from]
  if (moved === undefined) return []

  next.splice(from, 1)
  next.splice(to, 0, moved)

  return next.flatMap((preset, index) => {
    if (preset.sortOrder === index) return []
    return [{ ...preset, sortOrder: index }]
  })
}

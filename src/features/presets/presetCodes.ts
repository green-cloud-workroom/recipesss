import type { Preset, RecipeDraft } from '../../types/recipe'

const CODE_RE = /^([A-Z])(\d+)$/
const A_CODE = 'A'.charCodeAt(0)

export type ParsedCode = { prefix: string; suffix: number }

export function parseCode(code: string): ParsedCode | null {
  const match = CODE_RE.exec(code)
  if (!match) return null

  const prefix = match[1]
  const suffixRaw = match[2]
  if (prefix === undefined || suffixRaw === undefined) return null

  return { prefix, suffix: Number.parseInt(suffixRaw, 10) }
}

export function preferredPrefixOfDraft(
  presets: Preset[],
  draftId: string,
): string {
  const counts = new Map<string, number>()
  let firstSeen = ''

  for (const preset of sortPresets(presets)) {
    if (preset.draftId !== draftId) continue

    const parsed = parseCode(preset.code)
    if (!parsed) continue

    counts.set(parsed.prefix, (counts.get(parsed.prefix) ?? 0) + 1)
    if (!firstSeen) firstSeen = parsed.prefix
  }

  if (counts.size === 0) return ''

  let best = firstSeen
  let bestCount = counts.get(best) ?? 0
  for (const [prefix, count] of counts) {
    if (count > bestCount) {
      best = prefix
      bestCount = count
    }
  }

  return best
}

export function pickPrefix(
  presets: Preset[],
  drafts: RecipeDraft[],
  draftId: string,
): string {
  const own = preferredPrefixOfDraft(presets, draftId)
  if (own) return own

  const taken = new Set<string>()
  for (const preset of presets) {
    if (preset.draftId === draftId) continue

    const parsed = parseCode(preset.code)
    if (parsed) taken.add(parsed.prefix)
  }

  const sortedDrafts = sortDrafts(drafts)
  const draftIndex = sortedDrafts.findIndex((draft) => draft.id === draftId)
  if (draftIndex >= 0 && draftIndex < 26) {
    const indexedLetter = letterAt(draftIndex)
    if (!taken.has(indexedLetter)) return indexedLetter
  }

  for (let index = 0; index < 26; index += 1) {
    const letter = letterAt(index)
    if (!taken.has(letter)) return letter
  }

  return 'P'
}

export function pickSuffix(
  presets: Preset[],
  draftId: string,
  prefix: string,
): number {
  const used = new Set<number>()

  for (const preset of presets) {
    if (preset.draftId !== draftId) continue

    const parsed = parseCode(preset.code)
    if (parsed?.prefix === prefix) used.add(parsed.suffix)
  }

  let suffix = 0
  while (used.has(suffix)) suffix += 1
  return suffix
}

export function generatePresetCode(
  presets: Preset[],
  drafts: RecipeDraft[],
  draftId: string,
): string {
  const prefix = pickPrefix(presets, drafts, draftId)
  const suffix = pickSuffix(presets, draftId, prefix)
  return `${prefix}${suffix}`
}

// SPEC §6.7 / DL-035 — 한 draft의 프리셋을 targetWeight 오름차순으로 X0·X1·X2…
// 재코딩 + sortOrder 동일 순위 부여. v2 computeNormalizedPresets의 단일 draft 버전.
// 반환 = 해당 draft 프리셋만 (code·sortOrder 갱신된 새 배열). 상위에서 batch write.
export function normalizePresetCodes(
  presets: Preset[],
  drafts: RecipeDraft[],
  draftId: string,
): Preset[] {
  const prefix = pickPrefix(presets, drafts, draftId)
  return presets
    .filter((preset) => preset.draftId === draftId)
    .sort(
      (a, b) =>
        a.targetWeight - b.targetWeight ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    )
    .map((preset, index) => ({
      ...preset,
      code: `${prefix}${index}`,
      sortOrder: index,
    }))
}

function letterAt(index: number): string {
  return String.fromCharCode(A_CODE + index)
}

function sortDrafts(drafts: RecipeDraft[]): RecipeDraft[] {
  return [...drafts].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  )
}

function sortPresets(presets: Preset[]): Preset[] {
  return [...presets].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  )
}

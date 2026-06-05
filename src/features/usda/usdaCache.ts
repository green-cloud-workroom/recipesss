import { doc, getDoc, setDoc } from 'firebase/firestore'

import { db } from '../../firebase'
import type { UsdaCacheEntry } from '../../types/recipe'

function usdaCacheRef(fdcId: number) {
  return doc(db, 'usdaCache', String(fdcId))
}

export async function readUsdaCache(
  fdcId: number,
): Promise<UsdaCacheEntry | null> {
  const snap = await getDoc(usdaCacheRef(fdcId))
  if (!snap.exists()) return null
  return snap.data() as UsdaCacheEntry
}

export async function writeUsdaCache(entry: UsdaCacheEntry): Promise<void> {
  await setDoc(usdaCacheRef(entry.fdcId), entry)
}

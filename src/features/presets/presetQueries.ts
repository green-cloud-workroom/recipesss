import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

export async function fetchPresets(uid: string): Promise<Preset[]> {
  const snap = await getDocs(collection(db, `recipesssPresets/${uid}/items`))
  const presets = snap.docs.map((docSnap) => ({
    ...(docSnap.data() as Preset),
    id: docSnap.id,
  }))

  return presets.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function usePresets(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipesssPresets'],
    queryFn: () => fetchPresets(uid as string),
    enabled: !!uid,
  })
}

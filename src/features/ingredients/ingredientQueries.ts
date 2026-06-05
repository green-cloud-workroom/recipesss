import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Ingredient } from '../../types/recipe'

export async function fetchIngredients(uid: string): Promise<Ingredient[]> {
  const snap = await getDocs(collection(db, `recipesssIngredients/${uid}/items`))
  const ingredients = snap.docs.map((docSnap) => ({
    ...(docSnap.data() as Ingredient),
    id: docSnap.id,
  }))

  return ingredients.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function useIngredients(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipesssIngredients'],
    queryFn: () => fetchIngredients(uid as string),
    enabled: !!uid,
  })
}

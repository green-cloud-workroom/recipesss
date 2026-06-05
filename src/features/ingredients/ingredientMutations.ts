import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, setDoc } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Ingredient } from '../../types/recipe'

function ingredientRef(uid: string, ingredientId: string) {
  return doc(db, `recipesssIngredients/${uid}/items`, ingredientId)
}

export function useUpdateIngredient(uid: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ingredient: Ingredient) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(ingredientRef(uid, ingredient.id), ingredient)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['recipesssIngredients'] }),
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Ingredient, RecipeDraft } from '../../types/recipe'

function ingredientRef(uid: string, ingredientId: string) {
  return doc(db, `recipesssIngredients/${uid}/items`, ingredientId)
}

function draftRef(uid: string, draftId: string) {
  return doc(db, `recipeDrafts/${uid}/items`, draftId)
}

export function useUpdateIngredient(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]

  return useMutation({
    mutationFn: async (ingredient: Ingredient) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(ingredientRef(uid, ingredient.id), ingredient)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ingredientsQueryKey }),
  })
}

export function useMergeIngredients(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]
  const draftsQueryKey = ['recipeDrafts', uid]

  return useMutation({
    mutationFn: async ({
      changedDrafts,
      deleteIds,
      target,
    }: {
      target: Ingredient
      deleteIds: string[]
      changedDrafts: RecipeDraft[]
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')

      const batch = writeBatch(db)
      batch.set(ingredientRef(uid, target.id), target)
      for (const ingredientId of deleteIds) {
        batch.delete(ingredientRef(uid, ingredientId))
      }
      for (const draft of changedDrafts) {
        batch.set(draftRef(uid, draft.id), draft)
      }

      await batch.commit()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ingredientsQueryKey })
      void queryClient.invalidateQueries({ queryKey: draftsQueryKey })
    },
  })
}

export function useDeleteIngredient(uid: string | undefined) {
  const queryClient = useQueryClient()
  const ingredientsQueryKey = ['recipesssIngredients', uid]

  return useMutation({
    mutationFn: async (ingredientId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await deleteDoc(ingredientRef(uid, ingredientId))
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ingredientsQueryKey }),
  })
}

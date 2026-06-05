import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

function presetRef(uid: string, presetId: string) {
  return doc(db, `recipesssPresets/${uid}/items`, presetId)
}

export function useUpsertPreset(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssPresets', uid]

  return useMutation({
    mutationFn: async (preset: Preset) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(presetRef(uid, preset.id), preset)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useDeletePreset(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssPresets', uid]

  return useMutation({
    mutationFn: async (presetId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await deleteDoc(presetRef(uid, presetId))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useReorderPresets(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssPresets', uid]

  return useMutation({
    mutationFn: async (changed: Preset[]) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      if (changed.length === 0) return

      const batch = writeBatch(db)
      for (const preset of changed) {
        batch.set(presetRef(uid, preset.id), preset)
      }
      await batch.commit()
    },
    onMutate: async (changed: Preset[]) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Preset[]>(queryKey)

      if (previous) {
        const sortOrderById = new Map(
          changed.map((preset) => [preset.id, preset.sortOrder]),
        )
        queryClient.setQueryData(
          queryKey,
          previous.map((preset) => {
            const sortOrder = sortOrderById.get(preset.id)
            return sortOrder === undefined ? preset : { ...preset, sortOrder }
          }),
        )
      }

      return { previous }
    },
    onError: (_err, _changed, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })
}

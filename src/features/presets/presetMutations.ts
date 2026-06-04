import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteDoc, doc, setDoc } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

function presetRef(uid: string, presetId: string) {
  return doc(db, `recipesssPresets/${uid}/items`, presetId)
}

export function useUpsertPreset(uid: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (preset: Preset) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await setDoc(presetRef(uid, preset.id), preset)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['recipesssPresets'] }),
  })
}

export function useDeletePreset(uid: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (presetId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await deleteDoc(presetRef(uid, presetId))
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['recipesssPresets'] }),
  })
}

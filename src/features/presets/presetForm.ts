import { z } from 'zod'

export const presetFormSchema = z.object({
  code: z.string().trim().min(1, '코드를 입력하세요.'),
  targetWeight: z.coerce.number().positive('목표량은 0보다 커야 합니다.'),
  label: z.string(),
  inputAmount: z.coerce.number().min(0, '투입량은 0 이상이어야 합니다.'),
  inputUnitLabel: z.string(),
})

export type PresetFormInput = z.input<typeof presetFormSchema>

export type PresetFormValues = z.infer<typeof presetFormSchema>

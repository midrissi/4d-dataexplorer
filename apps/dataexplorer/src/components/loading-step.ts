export type LoadingStep = {
  id: string
  label: string
  status: 'pending' | 'loading' | 'done' | 'error'
  detail?: string
}

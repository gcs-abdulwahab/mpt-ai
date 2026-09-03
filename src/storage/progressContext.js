import { createContext, useContext } from 'react'

export const ProgressContext = createContext(null)

export function useProgress() {
  const value = useContext(ProgressContext)
  if (!value) throw new Error('useProgress must be used inside a ProgressProvider')
  return value
}

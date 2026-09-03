import { createContext, useContext } from 'react'

export const ContentContext = createContext(null)

export function useContent() {
  const value = useContext(ContentContext)
  if (!value) throw new Error('useContent must be used inside a ContentProvider')
  return value
}

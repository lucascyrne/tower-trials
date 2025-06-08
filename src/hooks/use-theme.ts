import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface UseThemeReturn {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    return (localStorage.getItem('theme') as Theme) || 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const root = window.document.documentElement
    
    const getSystemTheme = () => 
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

    const applyTheme = (newTheme: Theme) => {
      const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
      setResolvedTheme(resolved)
      
      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
    }

    applyTheme(theme)

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme(theme)
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return {
    theme,
    setTheme,
    resolvedTheme
  }
} 
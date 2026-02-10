import { create } from 'zustand'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  setUser: (user: User) => void
  hasPermission: (key: string) => boolean
  getMaxDiscount: () => number
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true })
    try {
      const result = await window.api.auth.login(username, password)
      if (result.success && result.user) {
        set({ user: result.user, isAuthenticated: true, isLoading: false })
        return { success: true }
      }
      set({ isLoading: false })
      return { success: false, error: result.error || 'Login failed' }
    } catch (error) {
      set({ isLoading: false })
      return { success: false, error: (error as Error).message }
    }
  },

  logout: () => {
    set({ user: null, isAuthenticated: false })
  },

  setUser: (user: User) => {
    set({ user, isAuthenticated: true })
  },

  hasPermission: (key: string) => {
    const { user } = get()
    if (!user) return false
    // Owner/Admin has all permissions
    if (user.role_id === 1) return true
    return user.permissions[key] === '1' || user.permissions[key] === 'true'
  },

  getMaxDiscount: () => {
    const { user } = get()
    if (!user) return 0
    return parseInt(user.permissions['max_discount_pct'] ?? '0', 10)
  }
}))

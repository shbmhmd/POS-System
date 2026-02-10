import { create } from 'zustand'
import type { Business, Branch, Shift } from '@/types'

interface AppState {
  // Business & Branch
  business: Business | null
  branches: Branch[]
  currentBranch: Branch | null

  // Shift
  currentShift: Shift | null

  // Setup
  isSetupComplete: boolean
  isLoading: boolean

  // Actions
  loadBusinessData: () => Promise<void>
  setBranches: (branches: Branch[]) => void
  setCurrentBranch: (branch: Branch) => void
  setCurrentShift: (shift: Shift | null) => void
  setSetupComplete: (complete: boolean) => void
  checkSetupStatus: () => Promise<boolean>
}

export const useAppStore = create<AppState>((set, get) => ({
  business: null,
  branches: [],
  currentBranch: null,
  currentShift: null,
  isSetupComplete: false,
  isLoading: true,

  loadBusinessData: async () => {
    try {
      const [bizResult, branchResult] = await Promise.all([
        window.api.settings.getBusiness(),
        window.api.settings.getBranches()
      ])

      const business = bizResult.success ? bizResult.data : null
      const branches = branchResult.success ? branchResult.data : []

      set({
        business,
        branches,
        currentBranch: branches.length > 0 ? branches[0] : null,
        isSetupComplete: !!business
      })
    } catch (error) {
      console.error('Failed to load business data:', error)
    }
  },

  setBranches: (branches) => set({ branches }),

  setCurrentBranch: (branch) => set({ currentBranch: branch }),

  setCurrentShift: (shift) => set({ currentShift: shift }),

  setSetupComplete: (complete) => set({ isSetupComplete: complete }),

  checkSetupStatus: async () => {
    try {
      const result = await window.api.setup.checkCompleted()
      const completed = result.success && result.data?.completed
      set({ isSetupComplete: completed, isLoading: false })
      if (completed) {
        await get().loadBusinessData()
      } else {
        set({ isLoading: false })
      }
      return completed
    } catch {
      set({ isSetupComplete: false, isLoading: false })
      return false
    }
  }
}))

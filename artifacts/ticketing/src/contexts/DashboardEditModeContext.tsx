import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';

interface DashboardEditModeContextValue {
  editMode: boolean;
  setEditMode: Dispatch<SetStateAction<boolean>>;
}

export const DashboardEditModeContext = createContext<DashboardEditModeContextValue | null>(null);

export function useDashboardEditMode() {
  const context = useContext(DashboardEditModeContext);
  if (!context) {
    throw new Error('useDashboardEditMode must be used inside DashboardEditModeContext.Provider');
  }
  return context;
}

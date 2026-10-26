// Archivo: app/dashboard/sidebar-context.tsx
import { createContext, useContext } from 'react';

export const SidebarContext = createContext({
  sidebarAbierto: true,
  toggleSidebar: () => {},
});

export const useSidebar = () => useContext(SidebarContext);
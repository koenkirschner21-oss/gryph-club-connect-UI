import { createContext, useContext, type ReactNode } from "react";
import { useNotificationsSubscription, type UseNotificationsReturn } from "../hooks/useNotifications";

const NotificationsContext = createContext<UseNotificationsReturn | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const notifications = useNotificationsSubscription();
  return (
    <NotificationsContext.Provider value={notifications}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): UseNotificationsReturn {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return ctx;
}

import { useContext } from "react";
import { ClubContext, type ClubContextValue } from "./clubContextValue";

export function useClubContext(): ClubContextValue {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error("useClubContext must be used within a ClubProvider");
  }
  return context;
}

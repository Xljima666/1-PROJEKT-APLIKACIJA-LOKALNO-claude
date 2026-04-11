
import React, { createContext, useContext } from "react";
import { useBrainPanelTech, type UseBrainPanelTechResult } from "./BrainPanelTech";

const BrainPanelTechContext = createContext<UseBrainPanelTechResult | null>(null);

export function BrainPanelTechProvider({
  children,
  activeNodes = [],
}: {
  children: React.ReactNode;
  activeNodes?: string[];
}) {
  const value = useBrainPanelTech(activeNodes);
  return (
    <BrainPanelTechContext.Provider value={value}>
      {children}
    </BrainPanelTechContext.Provider>
  );
}

export function useBrainPanelTechContext() {
  const ctx = useContext(BrainPanelTechContext);
  if (!ctx) {
    throw new Error("useBrainPanelTechContext must be used inside BrainPanelTechProvider");
  }
  return ctx;
}

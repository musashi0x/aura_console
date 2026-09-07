type Listener = () => void;

export interface MissionTemplate {
  id: string;
  title: string;
  objective: string;
  budgetUsdc: string;
  category: string;
}

export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  {
    id: "dex-liquidity",
    title: "DEX Liquidity Analysis",
    objective: "Analyze depth and 24h volume across top 3 Sui DEX liquidity pools",
    budgetUsdc: "50.000000",
    category: "DeFi",
  },
  {
    id: "market-research",
    title: "Market Intelligence",
    objective: "Research 3 market intelligence providers and compare dataset pricing",
    budgetUsdc: "25.000000",
    category: "Research",
  },
  {
    id: "counterparty-audit",
    title: "Counterparty Risk Audit",
    objective: "Audit counterparty settlement records and evaluate reliability",
    budgetUsdc: "15.000000",
    category: "Risk",
  },
  {
    id: "cross-dex-arbitrage",
    title: "Cross-DEX Arbitrage",
    objective: "Scan price discrepancies between Cetus and DeepBook for SUI/USDC",
    budgetUsdc: "20.000000",
    category: "Trading",
  },
  {
    id: "portfolio-rebalance",
    title: "Portfolio Rebalancing",
    objective: "Evaluate portfolio risk exposure and recommend rebalance limits",
    budgetUsdc: "30.000000",
    category: "Portfolio",
  },
];

let currentDraft: { objective: string; budget: string } = { objective: "", budget: "" };
const listeners = new Set<Listener>();

export function setDraftMission(objective: string, budget?: string) {
  currentDraft = { objective, budget: budget ?? currentDraft.budget };
  listeners.forEach((fn) => fn());
}

export function subscribeDraftMission(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDraftMission() {
  return currentDraft;
}

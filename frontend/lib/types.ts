export type Verdict = "" | "collusion" | "legitimate" | "inconclusive";
export type DisputeStatus = "filed" | "verdict_reached" | "closed";

export interface Dispute {
  id: string;
  complainant: string;
  respondent: string;
  market_id: string;
  evidence_json: string;
  context_url: string;
  bond: number;
  appeal_bond: number;
  last_appellant: string;
  status: DisputeStatus;
  verdict: Verdict;
  confidence: number;
  key_signals: string[];
  reasoning: string;
  appeal_count: number;
  max_appeals: number;
  filed_at: string;
  resolved_at: string;
}

export interface EvidenceRecord {
  t: string;
  agent: string;
  wallet?: string;
  type: "price_update" | "message" | "rebuttal";
  sku?: string;
  price?: number | null;
  text?: string;
}

export interface Scenario {
  kind: "clean" | "rigged";
  market_id: string;
  agents: { name: string; wallet: string; base_price: number; is_colluder: boolean }[];
  respondent_wallet: string;
  respondent_name: string;
  summary: string;
  evidence: EvidenceRecord[];
}

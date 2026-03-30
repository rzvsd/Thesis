export type ContrarianSignalValue = "positive" | "neutral" | "negative";

export interface ContrarianAlertAnchor {
  id: string;
  user_id: string;
  ticker: string;
  report_id?: string;
  signal_value: ContrarianSignalValue;
  anchor_price: number;
  anchored_at: string;
  expires_at: string;
  is_active: boolean;
}


export type SheetRow = Record<string, string>;

export type ChildRecord = {
  kid_index: string;
  kid_name: string;
  sessions_per_week: string;
  payment_plan?: string;
  evidence: string[];
};

export type IgnoredChild = {
  kid_index: string;
  raw_name: string;
  raw_sessions: string;
  reason: string;
};

export type ParsedSubmission = {
  id: string;
  submitted_at: string;
  source_form_key: string;
  source_row_key: string;
  parent_email: string;
  parent_name: string;
  parent_phone: string;
  parent_address: string;
  valid_children: ChildRecord[];
  ignored_children: IgnoredChild[];
  total_amount: number;
  already_invoiced: number;
};

export type SignupRow = {
  submitted_at: string;
  source_row_key: string;
  kid_index: string;
  parent_email: string;
  parent_name: string;
  parent_phone: string;
  parent_address: string;
  kid_name: string;
  sessions_per_week: string;
  pennylane_customer_id: string;
  pennylane_invoice_id: string;
  invoice_amount: string;
  invoice_status: string;
  created_at: string;
  paid_at: string;
  contract_status: string;
  error_notes: string;
  payment_cycle: PaymentCycle;
  payment_cycle_label: string;
  payment_expected_amount: number;
  payment_paid_amount: number;
  payment_status: PaymentStatus;
  payment_adjustment_reason: string;
  payment_adjustment_notes: string;
  payment_adjusted_at: string;
};

export type PaymentCycle = "reservation" | "trimester_1" | "trimester_2" | "trimester_3";

export type PaymentStatus = "pending" | "paid" | "partial" | "overpaid" | "waived";

export type PaymentCycleSummary = {
  cycle: PaymentCycle;
  label: string;
  expectedTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  paidRows: number;
  partialRows: number;
  pendingRows: number;
  adjustedRows: number;
};

export type DashboardData = {
  submissions: ParsedSubmission[];
  readyToInvoice: ParsedSubmission[];
  signups: SignupRow[];
  paymentCycleSummaries: PaymentCycleSummary[];
  metrics: {
    validChildrenPending: number;
    ignoredChildSections: number;
    readyFamilies: number;
    trackedInvoices: number;
    paidInvoices;
  };
};

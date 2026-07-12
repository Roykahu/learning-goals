export type SheetRow = Record<string, string>;

export type ChildRecord = {
  kid_index: string;
  kid_name: string;
  sessions_per_week: string;
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
};

export type DashboardData = {
  submissions: ParsedSubmission[];
  readyToInvoice: ParsedSubmission[];
  signups: SignupRow[];
  metrics: {
    validChildrenPending: number;
    ignoredChildSections: number;
    readyFamilies: number;
    trackedInvoices: number;
    paidInvoices: number;
  };
};

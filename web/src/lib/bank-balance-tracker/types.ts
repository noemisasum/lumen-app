export type BankBalanceKpis = {
  totalUsd: number;
  priorMonthUsd: number | null;
  movementUsd: number | null;
  movementPct: number | null;
  accounts: number;
  currencies: number;
  excludedUsdAccounts?: number;
};

export type CountrySummaryRow = {
  country: string;
  priorMonthUsd: number | null;
  currentMonthUsd: number;
  movementUsd: number | null;
  movementPct: number | null;
};

export type LicenseSummaryRow = {
  license: string;
  clientFundsUsd: number;
  corporateFundsUsd: number;
  totalUsd: number;
};

export type MonthlyBalanceRow = {
  monthEnd: string;
  country: string;
  accountEntity: string;
  bank: string;
  maskedAccountNo: string;
  fundType: string;
  currency: string;
  fxUnitsPerUsd: number | null;
  balanceLocal: number;
  balanceUsd: number | null;
  priorMonthUsd: number | null;
  movementUsd: number | null;
  movementPct: number | null;
  sourceWorkbook: string;
  statementFileRef: string | null;
  notes: string | null;
};

export type BankMappingRow = {
  country: string;
  accountEntity: string;
  bank: string;
  maskedAccountNo: string;
  fundType: string;
  currency: string;
  defaultActive: boolean;
  statementMatchingNotes: string | null;
};

export type StatementUploadColumn =
  | "Month End"
  | "Bank"
  | "Entity / Account"
  | "Statement Period"
  | "Statement File / Link"
  | "Status"
  | "Populated At"
  | "Notes";

export type TopBankRow = {
  bank: string;
  totalUsd: number;
  movementUsd: number | null;
};

export type BankConcentrationRow = {
  entityGroup: string;
  bank: string;
  totalUsd: number;
  proportion: number;
  hhiIndex: number;
  concentrationLevel: "Low" | "Moderate" | "High";
};

export type FxRateRow = {
  currency: string;
  name: string;
  unitsPerUsd: number;
  usdPerUnit: number;
};

export type BankBalanceWorkbookData = {
  metadata: {
    title: string;
    selectedMonth: string;
    lastRefreshed: string;
    dashboardView: string;
    workbookSheets: string[];
    source: string;
  };
  kpis: BankBalanceKpis;
  countrySummary: CountrySummaryRow[];
  licenseSummary: LicenseSummaryRow[];
  topBanks: TopBankRow[];
  concentration: BankConcentrationRow[];
  monthlyBalances: MonthlyBalanceRow[];
  bankMapping: BankMappingRow[];
  statementUploads: {
    columns: StatementUploadColumn[];
    rows: Array<Record<StatementUploadColumn, string | number | null>>;
  };
  fxRates: FxRateRow[];
  dataQualityIssues?: Array<{
    code: string;
    severity: "warning";
    message: string;
    entityId: string;
    bankAccountId: string;
    balanceId?: string;
    currency: string;
  }>;
};

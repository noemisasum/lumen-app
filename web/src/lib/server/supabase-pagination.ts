type SupabasePagedResult = {
  data: unknown[] | null;
  error: unknown;
};

type SupabasePagedQuery = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => {
      order: (column: string) => {
        range: (from: number, to: number) => PromiseLike<SupabasePagedResult>;
      };
    };
  };
};

export type SupabasePagedClient = {
  from: (table: string) => SupabasePagedQuery;
};

export const bankAccountRelatedRowsPageSize = 1000;

export async function loadBankAccountRelatedRowsPaged<T>(
  supabase: SupabasePagedClient,
  input: {
    table: string;
    selectColumns: string;
    accountIds: string[];
    orderColumn?: string;
    pageSize?: number;
  },
) {
  const pageSize = input.pageSize ?? bankAccountRelatedRowsPageSize;
  const orderColumn = input.orderColumn ?? "id";
  const rows: T[] = [];
  if (!input.accountIds.length) return rows;

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const result = await supabase.from(input.table).select(input.selectColumns).in("bank_account_id", input.accountIds).order(orderColumn).range(from, to);
    if (result.error) throw result.error;

    const page = result.data ?? [];
    rows.push(...(page as T[]));
    if (page.length < pageSize) return rows;
  }
}

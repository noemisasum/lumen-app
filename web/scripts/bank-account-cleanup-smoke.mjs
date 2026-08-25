import assert from "node:assert/strict";
import { loadBankAccountRelatedRowsPaged } from "../src/lib/server/supabase-pagination.ts";

const rows = Array.from({ length: 2501 }, (_, index) => ({
  bank_account_id: index % 2 === 0 ? "account-a" : "account-b",
}));
const ranges = [];
const supabase = {
  from(table) {
    assert.equal(table, "bank_account_transactions");
    return {
      select(columns) {
        assert.equal(columns, "bank_account_id");
        return {
          in(column, accountIds) {
            assert.equal(column, "bank_account_id");
            assert.deepEqual(accountIds, ["account-a", "account-b"]);
            return {
              order(orderColumn) {
                assert.equal(orderColumn, "id");
                return {
                  async range(from, to) {
                    ranges.push([from, to]);
                    return { data: rows.slice(from, to + 1), error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};

const loadedRows = await loadBankAccountRelatedRowsPaged(supabase, {
  table: "bank_account_transactions",
  selectColumns: "bank_account_id",
  accountIds: ["account-a", "account-b"],
});

assert.equal(loadedRows.length, 2501);
assert.deepEqual(ranges, [
  [0, 999],
  [1000, 1999],
  [2000, 2999],
]);

console.log("bank-account-cleanup smoke ok");

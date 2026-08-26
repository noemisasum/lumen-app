-- Allow treasury dashboard account categories without rewriting existing rows.
-- Historical 'bank' values remain valid and are treated as operating bank accounts by application code.

alter table public.entity_bank_accounts
  alter column account_type set default 'operating_bank';

alter table public.entity_bank_accounts
  drop constraint if exists entity_bank_accounts_account_type_check;

alter table public.entity_bank_accounts
  add constraint entity_bank_accounts_account_type_check
  check (account_type in ('bank','operating_bank','client_money','money_processor','liquidity_provider'));

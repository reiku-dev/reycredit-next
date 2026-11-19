-- ============================================================
-- REY CREDIT -- penalty rate stored per loan
-- Paste into the Supabase SQL editor and run once. Safe to run again.
--   penalty_rate   this loan's own monthly penalty %, as stated in its agreement.
--                  NULL (empty) = the loan follows the company-wide rate in Settings.
-- ============================================================
alter table loans add column if not exists penalty_rate numeric(5,2);

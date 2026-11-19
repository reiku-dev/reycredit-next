-- ============================================================
-- REY CREDIT -- ALL database updates in one file.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once: it only adds what is missing and never deletes data.
-- (A brand new database needs supabase-schema.sql run first.)
-- ============================================================

-- >>>>>>>>>> email-log-schema.sql
-- ============================================================
-- REY CREDIT -- Email log table
-- Paste into the Supabase SQL editor and run once.
-- Keeps its own record of every email the app sends, independent of
-- Resend's own 30-day dashboard retention and reachable without leaving
-- the app.
-- ============================================================
create table if not exists email_log (
  id          bigint generated always as identity primary key,
  loan_id     bigint references loans(id) on delete set null,
  borrower_name text default '',
  to_email    text not null,
  cc_email    text default '',
  email_type  text not null,     -- welcome | new_loan | statement | reminder | receipt | reset_pin
  subject     text default '',
  status      text not null check (status in ('sent','failed')),
  error_message text default '',
  resend_id   text default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_email_log_created on email_log(created_at desc);
create index if not exists idx_email_log_loan on email_log(loan_id);

alter table email_log enable row level security;

-- >>>>>>>>>> email-log-body.sql
-- ============================================================
-- REY CREDIT -- keep the email body in the Email log
-- Paste into the Supabase SQL editor and run once.
-- Adds two columns so the Email log page can show exactly what was sent.
-- Only emails sent AFTER this is run (and the update deployed) have a body.
-- ============================================================
alter table email_log add column if not exists body_html text;
alter table email_log add column if not exists attachment_names text default '';

-- >>>>>>>>>> bank-cost.sql
-- ============================================================
-- REY CREDIT -- what the bank / credit card charges YOU for each loan (admin only)
-- Paste into the Supabase SQL editor and run once.
--   bank_monthly  the monthly amount you pay the bank for this loan
--   bank_fee      one-time fee the bank charged you (0 if none)
--   bank_terms    how many months you pay the bank (blank = same as the loan's terms)
-- Borrowers never see these; they are used only for your profit figures.
-- ============================================================
alter table loans add column if not exists bank_monthly numeric(12,2) not null default 0;
alter table loans add column if not exists bank_fee numeric(12,2) not null default 0;
alter table loans add column if not exists bank_terms int;

-- >>>>>>>>>> late-fee.sql
-- ============================================================
-- REY CREDIT -- flat late payment fee, stored per loan
-- Paste into the Supabase SQL editor and run once.
--   late_fee       flat peso amount charged for every cycle not settled by its due date
--                  (0 = no late fee; this is what the loan's agreement will state)
--   late_fee_from  optional: only cycles due on/after this date are charged, so a fee
--                  agreed today is not applied to months that were already past
-- ============================================================
alter table loans add column if not exists late_fee numeric(12,2) not null default 0;
alter table loans add column if not exists late_fee_from date;

-- >>>>>>>>>> login-lockout.sql
-- Sign-in protection. Run once in the Supabase SQL Editor.
--  * 5 wrong passwords lock an account for 15 minutes
--  * "Forgot password" is limited to 3 requests an hour per account
-- Until this table exists the app still works, but without the lockout.
create table if not exists login_attempts (
  email              text primary key,
  failures           int not null default 0,
  last_failure       timestamptz,
  locked_until       timestamptz,
  resets             int not null default 0,
  reset_window_start timestamptz
);
alter table login_attempts enable row level security;

-- ============================================================
-- penalty-rate: each loan can carry its own monthly penalty %
-- (empty = follows the company default in Settings)
-- ============================================================
alter table loans add column if not exists penalty_rate numeric(5,2);

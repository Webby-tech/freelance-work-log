ALTER TABLE work_entries
  ADD COLUMN IF NOT EXISTS commission_exempt_amount numeric(10, 2) NOT NULL DEFAULT 0;

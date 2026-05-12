-- Replace single travel expense fields with a proper line-items table
ALTER TABLE work_entries DROP COLUMN IF EXISTS travel_expenses_description;

CREATE TABLE IF NOT EXISTS travel_expense_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_entry_id uuid NOT NULL REFERENCES work_entries(id) ON DELETE CASCADE,
  description   text NOT NULL,
  amount        numeric(10, 2) NOT NULL,
  created_at    timestamptz DEFAULT now()
);

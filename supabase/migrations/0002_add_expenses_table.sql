-- General expenses table for tax-deductible non-mileage business costs
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

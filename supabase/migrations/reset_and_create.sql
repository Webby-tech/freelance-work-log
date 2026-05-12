-- ============================================================
-- Actor Worklog — Full reset + create (safe to run multiple times)
-- ============================================================

-- 1. Tear everything down
DROP TABLE IF EXISTS work_entries  CASCADE;
DROP TABLE IF EXISTS invoices      CASCADE;
DROP TABLE IF EXISTS clients       CASCADE;
DROP TABLE IF EXISTS agents        CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- 2. Recreate tables

CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  address         TEXT,
  email           TEXT,
  commission_rate NUMERIC(5,4) DEFAULT 0.125,
  vat_registered  BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  email      TEXT,
  type       TEXT NOT NULL CHECK (type IN ('standard', 'payroll')),
  agent_id   UUID REFERENCES agents(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT NOT NULL UNIQUE,
  client_id       UUID REFERENCES clients(id),
  agent_id        UUID REFERENCES agents(id),
  type            TEXT NOT NULL CHECK (type IN ('client', 'agent_commission')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  issued_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'voided')),
  subtotal        NUMERIC(10,2) NOT NULL,
  commission_amt  NUMERIC(10,2),
  vat_amount      NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  notes           TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE work_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id),
  date                  DATE NOT NULL,
  end_date              DATE,
  location_name         TEXT NOT NULL,
  location_postcode     TEXT,
  location_lat          NUMERIC(9,6),
  location_lng          NUMERIC(9,6),
  details               TEXT,
  flat_fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  use_home_as_origin    BOOLEAN DEFAULT true,
  override_origin_name  TEXT,
  override_origin_pc    TEXT,
  override_origin_lat   NUMERIC(9,6),
  override_origin_lng   NUMERIC(9,6),
  calculated_miles_raw  NUMERIC(8,2),
  return_miles          INTEGER,
  mileage_rate          NUMERIC(6,4) DEFAULT 0.45,
  travel_expenses       NUMERIC(10,2) DEFAULT 0,
  invoice_id            UUID REFERENCES invoices(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_settings (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID,
  home_postcode                 TEXT NOT NULL DEFAULT 'SW1A 1AA',
  home_lat                      NUMERIC(9,6),
  home_lng                      NUMERIC(9,6),
  legal_name                    TEXT,
  trading_name                  TEXT,
  address                       TEXT,
  email                         TEXT,
  phone                         TEXT,
  utr_number                    TEXT,
  vat_number                    TEXT,
  vat_registered                BOOLEAN DEFAULT false,
  bank_name                     TEXT,
  bank_sort_code                TEXT,
  bank_account                  TEXT,
  default_mileage_rate          NUMERIC(6,4) DEFAULT 0.45,
  invoice_prefix                TEXT DEFAULT 'INV',
  tax_year_start                TEXT DEFAULT '04-06',
  personal_allowance_exhausted  BOOLEAN DEFAULT false,
  use_flat_tax_rate             BOOLEAN DEFAULT false,
  flat_tax_rate_override        NUMERIC(5,4) DEFAULT 0.20,
  prior_year_tax_bill           NUMERIC(10,2),
  poa_jan_paid                  NUMERIC(10,2) DEFAULT 0,
  poa_jul_paid                  NUMERIC(10,2) DEFAULT 0,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

-- 3. updated_at function + triggers

CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER work_entries_updated_at
  BEFORE UPDATE ON work_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Seed default settings
-- personal_allowance_exhausted = true: pension income exhausts full PA,
-- all acting income taxable from £1. No NI fields — age 67.

INSERT INTO user_settings (
  home_postcode,
  personal_allowance_exhausted,
  use_flat_tax_rate,
  flat_tax_rate_override,
  default_mileage_rate,
  tax_year_start,
  invoice_prefix
) VALUES (
  'SW1A 1AA',
  true,
  false,
  0.20,
  0.45,
  '04-06',
  'INV'
);

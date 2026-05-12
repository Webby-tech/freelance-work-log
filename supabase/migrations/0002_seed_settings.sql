-- Seed default user settings for single-user setup
-- personal_allowance_exhausted = true: pension income uses full PA, all acting income taxable from £1
-- No NI fields anywhere — user is 67, past state pension age

INSERT INTO user_settings (
  home_postcode,
  personal_allowance_exhausted,
  use_flat_tax_rate,
  flat_tax_rate_override,
  default_mileage_rate,
  tax_year_start,
  invoice_prefix
) VALUES (
  'SW1A 1AA',   -- placeholder — user must update in Settings
  true,          -- pension income exhausts personal allowance
  false,
  0.20,
  0.45,          -- HMRC rate: 45p/mile (first 10,000 miles)
  '04-06'        -- UK tax year: 6 April
)
ON CONFLICT DO NOTHING;

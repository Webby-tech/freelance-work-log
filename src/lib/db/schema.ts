import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  date,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// ─── Agents ──────────────────────────────────────────────────────────────────

export const agents = pgTable('agents', {
  id:             uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name:           text('name').notNull(),
  address:        text('address'),
  email:          text('email'),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).default('0.125'),
  vatRegistered:  boolean('vat_registered').default(false),
  deletedAt:      timestamp('deleted_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).default(sql`now()`),
})

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clients = pgTable('clients', {
  id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name:      text('name').notNull(),
  address:   text('address'),
  email:     text('email'),
  phone:     text('phone'),
  type:      text('type').notNull().$type<'standard' | 'payroll'>(),
  agentId:   uuid('agent_id').references(() => agents.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
})

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text('invoice_number').notNull().unique(),
  clientId:      uuid('client_id').references(() => clients.id),
  agentId:       uuid('agent_id').references(() => agents.id),
  type:          text('type').notNull().$type<'client' | 'agent_commission'>(),
  periodStart:   date('period_start').notNull(),
  periodEnd:     date('period_end').notNull(),
  issuedDate:    date('issued_date').notNull().default(sql`CURRENT_DATE`),
  dueDate:       date('due_date'),
  status:        text('status').notNull().default('draft').$type<'draft' | 'sent' | 'paid' | 'overdue' | 'voided'>(),
  subtotal:      numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  commissionAmt: numeric('commission_amt', { precision: 10, scale: 2 }),
  vatAmount:     numeric('vat_amount', { precision: 10, scale: 2 }).default('0'),
  total:         numeric('total', { precision: 10, scale: 2 }).notNull(),
  notes:         text('notes'),
  pdfUrl:        text('pdf_url'),
  createdAt:     timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
})

// ─── Work Entries ─────────────────────────────────────────────────────────────

export const workEntries = pgTable('work_entries', {
  id:                  uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clientId:            uuid('client_id').notNull().references(() => clients.id),
  date:                date('date').notNull(),
  endDate:             date('end_date'),
  locationName:        text('location_name').notNull(),
  locationPostcode:    text('location_postcode'),
  locationLat:         numeric('location_lat', { precision: 9, scale: 6 }),
  locationLng:         numeric('location_lng', { precision: 9, scale: 6 }),
  details:             text('details'),
  flatFee:             numeric('flat_fee', { precision: 10, scale: 2 }).notNull().default('0'),

  useHomeAsOrigin:     boolean('use_home_as_origin').default(true),
  overrideOriginName:  text('override_origin_name'),
  overrideOriginPc:    text('override_origin_pc'),
  overrideOriginLat:   numeric('override_origin_lat', { precision: 9, scale: 6 }),
  overrideOriginLng:   numeric('override_origin_lng', { precision: 9, scale: 6 }),
  calculatedMilesRaw:  numeric('calculated_miles_raw', { precision: 8, scale: 2 }),
  returnMiles:         integer('return_miles'),
  mileageRate:         numeric('mileage_rate', { precision: 6, scale: 4 }).default('0.45'),
  travelExpenses:         numeric('travel_expenses', { precision: 10, scale: 2 }).default('0'),
  commissionExemptAmount: numeric('commission_exempt_amount', { precision: 10, scale: 2 }).default('0'),

  invoiceId:           uuid('invoice_id').references(() => invoices.id),
  notes:               text('notes'),

  createdAt:           timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
})

// ─── Travel Expense Items ─────────────────────────────────────────────────────

export const travelExpenseItems = pgTable('travel_expense_items', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workEntryId: uuid('work_entry_id').notNull().references(() => workEntries.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount:      numeric('amount', { precision: 10, scale: 2 }).notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).default(sql`now()`),
})

// ─── General Expenses ─────────────────────────────────────────────────────────

export const expenses = pgTable('expenses', {
  id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  date:        date('date').notNull(),
  category:    text('category').notNull(),
  description: text('description').notNull(),
  amount:      numeric('amount', { precision: 10, scale: 2 }).notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
})

// ─── User Settings ────────────────────────────────────────────────────────────

export const userSettings = pgTable('user_settings', {
  id:                         uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId:                     uuid('user_id'),
  homePostcode:               text('home_postcode').notNull().default('SW1A 1AA'),
  homeLat:                    numeric('home_lat', { precision: 9, scale: 6 }),
  homeLng:                    numeric('home_lng', { precision: 9, scale: 6 }),
  legalName:                  text('legal_name'),
  tradingName:                text('trading_name'),
  address:                    text('address'),
  email:                      text('email'),
  phone:                      text('phone'),
  utrNumber:                  text('utr_number'),
  vatNumber:                  text('vat_number'),
  vatRegistered:              boolean('vat_registered').default(false),
  bankName:                   text('bank_name'),
  bankSortCode:               text('bank_sort_code'),
  bankAccount:                text('bank_account'),
  defaultMileageRate:         numeric('default_mileage_rate', { precision: 6, scale: 4 }).default('0.45'),
  invoicePrefix:              text('invoice_prefix').default('INV'),
  invoiceFooter:              text('invoice_footer'),
  taxYearStart:               text('tax_year_start').default('04-06'),

  personalAllowanceExhausted: boolean('personal_allowance_exhausted').default(false),
  useFlatTaxRate:             boolean('use_flat_tax_rate').default(false),
  flatTaxRateOverride:        numeric('flat_tax_rate_override', { precision: 5, scale: 4 }).default('0.20'),
  priorYearTaxBill:           numeric('prior_year_tax_bill', { precision: 10, scale: 2 }),
  poaJanPaid:                 numeric('poa_jan_paid', { precision: 10, scale: 2 }).default('0'),
  poaJulPaid:                 numeric('poa_jul_paid', { precision: 10, scale: 2 }).default('0'),

  createdAt:                  timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt:                  timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const agentsRelations = relations(agents, ({ many }) => ({
  clients: many(clients),
  invoices: many(invoices),
}))

export const clientsRelations = relations(clients, ({ one, many }) => ({
  agent: one(agents, { fields: [clients.agentId], references: [agents.id] }),
  workEntries: many(workEntries),
  invoices: many(invoices),
}))

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  agent: one(agents, { fields: [invoices.agentId], references: [agents.id] }),
  workEntries: many(workEntries),
}))

export const workEntriesRelations = relations(workEntries, ({ one }) => ({
  client: one(clients, { fields: [workEntries.clientId], references: [clients.id] }),
  invoice: one(invoices, { fields: [workEntries.invoiceId], references: [invoices.id] }),
}))

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert

export type ClientType = 'standard' | 'payroll'
export type InvoiceType = 'client' | 'agent_commission'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'voided'

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type WorkEntry = typeof workEntries.$inferSelect
export type NewWorkEntry = typeof workEntries.$inferInsert
export type UserSettings = typeof userSettings.$inferSelect
export type NewUserSettings = typeof userSettings.$inferInsert

export type TravelExpenseItem    = typeof travelExpenseItems.$inferSelect
export type NewTravelExpenseItem = typeof travelExpenseItems.$inferInsert

export type ClientWithAgent = Client & { agent: Agent | null }
export type WorkEntryWithClient = WorkEntry & { client: Client }
export type InvoiceWithClient = Invoice & { client: Client | null; agent: Agent | null }

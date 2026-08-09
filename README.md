# Rental Backend (MERN — Odoo-inspired Rental Engine)

Express + MongoDB backend implementing a rental-management engine: lifecycle
state machine, availability/overlap checking, time-based pricing, an
automatic late-fee engine, security deposit settlement, pickup/return
workflows, and analytics endpoints for a React admin dashboard (Recharts).

**The backend is the source of truth for all money and inventory decisions.**
No pricing, late fee, deposit, or availability figure sent from the frontend
is ever trusted — everything is recomputed server-side in `utils/rentalEngine.js`.

## Setup

```bash
cd rental-backend
npm install
cp .env.example .env    # then edit MONGO_URI / JWT_SECRET
npm run seed             # creates admin + customer + 2 sample products
npm run dev               # nodemon on PORT (default 5000)
```

Seeded logins:
- `admin@rental.com` / `password123` (role: admin)
- `customer@rental.com` / `password123` (role: customer)

## Project structure

```
config/db.js                 Mongo connection
models/                      User, Category, Product, Rental, Pickup,
                              Return, InventoryTransaction, Settings
utils/rentalEngine.js         pricing, availability, late fee, refund logic
utils/overdueCheck.js         lazy OVERDUE status sync (no cron needed for v1)
utils/seed.js                 sample data
middleware/auth.js            JWT auth + role guard
middleware/errorHandler.js
controllers/                  route handlers per resource
routes/                       express routers per resource
server.js                     app entrypoint
```

## Core concepts

### Rental lifecycle (state machine)
`QUOTATION → RESERVED → CONFIRMED → READY_FOR_PICKUP → PICKED_UP → ACTIVE
→ RETURN_DUE/OVERDUE → RETURNED → INSPECTION → DEPOSIT_SETTLEMENT → COMPLETED`
(or `CANCELLED` from most pre-pickup states).
Valid transitions are enforced in `models/Rental.js` (`VALID_TRANSITIONS`) and
checked in `rentalController.updateRentalStatus`.

### Pricing engine
`Product.pricingTiers` holds hourly/daily/weekly/monthly price lines.
`calculateRentalPrice()` picks the best-fit tier for the requested duration
and returns a `{unit, unitPrice, billedUnits, rentalSubtotal}` snapshot that
is stored on the Rental at creation time — it is never recalculated from
scratch later, so historical rentals aren't affected by future price changes.

### Availability engine
`checkAvailability()` sums quantities of all non-cancelled/non-completed
rentals whose window overlaps the requested window (each existing rental's
window extended by its padding buffer), and rejects the booking if it would
exceed `product.totalQuantity`.

### Late fee engine (the key differentiator)
`calculateLateFee()`:
1. delay = actualReturnAt - expectedReturnAt
2. subtract the configured grace period
3. bill hourly up to `dailySwitchHours`, then switch to daily billing
4. clamp to `maximumFee`
Rules resolve product-level overrides first, falling back to global
`Settings`. This only ever runs server-side, inside `returnController.recordReturn`.

### Deposit settlement
`calculateRefund(deposit, lateFee, damageDeduction)` floors refund at 0 and
sets status `HELD | PARTIALLY_REFUNDED | REFUNDED | DEDUCTED`.

### Overdue detection
No cron job required for v1: `syncOverdueStatuses()` runs at the top of every
rental list/detail/dashboard fetch and flips any `ACTIVE`/`RETURN_DUE` rental
past its `expectedReturnAt` to `OVERDUE`. Swap in `node-cron` later without
changing any other code if you want it running independently of requests.

## API overview

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/categories
POST   /api/categories                (admin/staff)

GET    /api/products
GET    /api/products/:id
POST   /api/products/:id/quote        price + availability preview, no auth required
POST   /api/products                  (admin/staff)
PUT    /api/products/:id              (admin/staff)
DELETE /api/products/:id              (admin)

GET    /api/rentals/dashboard         (admin/staff) KPI + revenue/deposit/late-fee totals
GET    /api/rentals                   list (customers see only their own)
GET    /api/rentals/:id
POST   /api/rentals                   create (RESERVED), backend computes price+deposit
PATCH  /api/rentals/:id/status        (admin/staff) guarded state transition

GET    /api/pickups/today             (admin/staff)
POST   /api/pickups                   (admin/staff) records handover, moves to ACTIVE

GET    /api/returns/today             (admin/staff)
GET    /api/returns/overdue           (admin/staff)
POST   /api/returns                   (admin/staff) inspection + late fee + deposit settlement

GET    /api/analytics/revenue?range=30d
GET    /api/analytics/rentals?range=30d
GET    /api/analytics/status
GET    /api/analytics/products?range=30d&limit=10
GET    /api/analytics/late-fees?range=30d
GET    /api/analytics/deposits

GET    /api/settings                  (admin/staff)
PUT    /api/settings                  (admin) late fee / padding / unavailable days config
```

## Example flow (curl)

```bash
# 1. Login as admin
curl -s -X POST localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@rental.com","password":"password123"}'
# -> copy the token

TOKEN="paste_token_here"

# 2. Preview price/availability
curl -s -X POST localhost:5000/api/products/<PRODUCT_ID>/quote \
  -H "Content-Type: application/json" \
  -d '{"startAt":"2026-08-10T10:00:00Z","endAt":"2026-08-12T10:00:00Z","quantity":1}'

# 3. Create rental
curl -s -X POST localhost:5000/api/rentals \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","quantity":1,"startAt":"2026-08-10T10:00:00Z","expectedReturnAt":"2026-08-12T10:00:00Z"}'

# 4. As admin/staff: record pickup, then later record return
curl -s -X POST localhost:5000/api/pickups \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"rentalId":"<RENTAL_ID>","quantityHandedOver":1}'

curl -s -X POST localhost:5000/api/returns \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"rentalId":"<RENTAL_ID>","quantityReturned":1,"condition":"good"}'
```

## Wiring to React

- Use Axios with an interceptor attaching `Authorization: Bearer <token>`.
- Recharts on the frontend consumes the `/api/analytics/*` endpoints directly
  (each already returns chart-ready arrays of `{date, value}`-shaped objects).
- Never compute price, late fee, or refund in the frontend — call
  `POST /api/products/:id/quote` for previews and let `POST /api/rentals` /
  `POST /api/returns` persist the authoritative numbers.

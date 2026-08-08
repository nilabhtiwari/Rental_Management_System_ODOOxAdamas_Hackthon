# RentalFlow API

Standalone Node/Express/MongoDB backend. It is intentionally not connected to the current frontend.

## Start

1. Install MongoDB locally and start it.
2. Copy `.env.example` to `.env` and set `JWT_SECRET`.
3. Run `npm install`, then `npm run dev` from this `server` folder.
4. The API runs at `http://localhost:5000`; health check: `GET /api/health`.

The first successful connection seeds demo users and products. Demo credentials: `customer@demo.com` / `Customer@123`, and `admin@demo.com` / `Admin@123`.

## Razorpay Test Mode

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with Test Mode keys. The server creates Razorpay orders and verifies the returned HMAC signature. No key secret is sent from this API. If keys are absent, payment endpoints return a configuration error; orders are never marked paid.

## API groups

- `/api/auth` registration, login, profile, password reset development flow
- `/api/products` public catalogue and admin CRUD
- `/api/orders` customer orders, admin status transitions, returns and settlements
- `/api/admin` dashboard analytics, coupons, quotations and settings
- `/api/payments` Razorpay Test Mode create/verify endpoints

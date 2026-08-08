# Rental Management System — Detailed Frontend Requirements

## 1. Purpose and delivery standard

Build a complete, runnable, frontend-only enterprise rental-management application. It must behave like a real product, not a set of static mockups: navigation, forms, calculations, CRUD operations, order state transitions, validation, loading feedback, empty states, and every visible action must work. A user must be able to run it locally with `npm install` then `npm run dev`.

The implementation is a browser demo, so authentication and payments are simulated. This limitation must be clear in code and behavior, but must never leave a flow unfinished. React state, Context, mock data, calculated values, and `localStorage` provide the backend-like behavior.

## 2. Mandatory technology and project constraints

Use React, JavaScript/JSX, Vite, Tailwind CSS, React Router, and Lucide React icons only. Do not use TypeScript, Next.js, Redux, Material UI, Bootstrap, Angular, Vue, Firebase, Supabase, external authentication, external payments, or unnecessary UI/chart libraries.

Keep the file structure compact and maintainable. A suitable shape is:

```text
src/
  components/        reusable UI and layout components
  pages/             customer/auth/checkout pages
  admin/             admin pages and admin layout
  context/           auth, application data, toast state
  data/              initial seed data
  utils/             storage, validation, rental calculations
  App.jsx
  main.jsx
  index.css
```

Use Tailwind for almost all styling. Limit `index.css` to reset/base styles, scrollbar, body/font styles, and truly global effects.

## 3. Product roles and access control

Roles are `customer`, `admin`, and `vendor`. Store the logged-in user in `localStorage`; reloads must restore the session. Implement a reusable `ProtectedRoute` that redirects unauthenticated visitors to login and prevents customers from viewing `/admin/*` (redirect them to the customer product area). Admins may use all admin routes. Vendors can register and may have a basic vendor area if included.

Provide these test accounts on the login page:

| Role | Email | Password |
|---|---|---|
| Customer | `customer@demo.com` | `Customer@123` |
| Admin | `admin@demo.com` | `Admin@123` |
| Vendor | `vendor@demo.com` | `Vendor@123` |

The central auth API must expose `login()`, `logout()`, `register()`, and `resetPassword()`. Logging out clears only the authenticated session, never the customer’s saved cart or history.

## 4. State, persistence, and data integrity

Create a centralized application-data layer using React Context and storage helpers named `getStorage()`, `setStorage()`, and `removeStorage()`. Handle malformed/corrupt stored JSON safely by falling back to valid defaults. Seed data only on first launch; use an initialization flag and never overwrite data users create later.

Persist at least the following keys/data domains:

```text
rental_users, rental_current_user, rental_products, rental_cart,
rental_wishlist, rental_orders, rental_addresses, rental_coupons,
rental_settings, rental_quotations, rental_pricelists,
rental_periods, notifications, payments, security_deposits
```

Core object models:

```js
Product = { id, name, category, brand, description, image, stock,
  availability, pricing, variants, securityDeposit, rating }

User = { id, firstName, lastName, email, password, role, phone,
  avatar, addresses }

Order = { id, userId, items, rentalStart, rentalEnd, deliveryMethod,
  address, subtotal, discount, deliveryFee, securityDeposit, total,
  paymentStatus, rentalStatus, lateFee, refundAmount, createdAt }
```

Seed at least 10 realistic products—sofa, television, desktop computer, laptop, gaming console, bed, speaker, camera, projector, and office chair—plus at least 3 customers and 8 orders with meaningful combinations of upcoming pickups/returns, active rentals, completed rentals, deposits, late-fee data, and at least one overdue rental.

## 5. Visual and responsive design direction

Use a dark, modern enterprise commerce aesthetic: near-black/charcoal page surfaces (`zinc-950`, `zinc-900`, `zinc-800`), thin `zinc-700` borders, rounded-xl cards, restrained shadows, white/light-gray type, blue/purple primary accents, green success, amber warning, and red error/overdue states. Avoid generic Bootstrap-like layouts, giant type, excessive gradients, and excessive animation.

The desktop experience should match the supplied design direction: compact professional dashboards, card grids, polished tables, modals, badges, focus states, subtle hover transitions, and toast feedback. Design all pages for desktop, laptop, tablet, and phone. On mobile, sidebars become drawers; dense product grids become one/two columns; tables scroll horizontally or become cards; checkout columns stack. Do not cause unnecessary horizontal overflow.

Accessibility is required: semantic landmarks/controls, associated labels, keyboard-friendly buttons and dialogs, visible focus treatments, readable contrast, and meaningful image alt text. Use image fallback UI if a remote product image cannot load.

## 6. Route map

Customer/auth routes:

```text
/                         splash/entry redirect
/login                    login
/signup                   customer registration
/forgot-password          password-reset request
/reset-password           simulated reset form
/products                 product catalogue
/products/:id             product detail/configuration
/cart
/checkout/address
/checkout/payment
/checkout/success
/orders
/orders/:id
/wishlist
/profile
/profile/settings
/profile/addresses
/vendor/signup
```

Admin routes:

```text
/admin, /admin/dashboard, /admin/products, /admin/products/new,
/admin/products/:id/edit, /admin/orders, /admin/rentals,
/admin/customers, /admin/pickups, /admin/returns, /admin/deposits,
/admin/pricing, /admin/rental-periods, /admin/coupons,
/admin/quotations, /admin/settings, /admin/analytics
```

Include a polished 404 route and friendly “Product Not Found” / “Order Not Found” states. Internal navigation must use React Router links/navigation—not full-page reloads.

## 7. Entry, authentication, and account pages

On first application entry, show a professional splash screen containing logo, “Rental Management System”, and subtle loading motion. After roughly 1–2 seconds redirect a stored session by role (admin to admin dashboard; customer to products) or otherwise to login.

The login page needs Login ID/Email and Password fields, password visibility toggle, inline required/credential errors, loading state, success redirect, forgot-password link, registration link, and the demo-account panel above. Invalid credentials must not authenticate.

The signup page creates a customer and then logs them in automatically. Require first name, last name, valid unique email, password, and matching confirm password. Password validation is 6–12 characters with uppercase, lowercase, special character, and preferably a number. Show errors directly under relevant fields.

Forgot password validates the entered email against stored users and then shows the simulated “Password reset link has been sent to your email.” message. The reset page accepts/validates a new password and confirmation, updates the stored user, and provides a route back to login. Vendor signup contains first/last name, company name, company category, GST number, email, password, and confirmation; categories include Electronics, Furniture, Vehicles, Appliances, Cameras, Computers, and Other.

## 8. Customer shell, catalogue, search, and filters

The customer navbar contains a logo; Products, Terms & Conditions, About Us, and Contact Us links; a centered product search field; and wishlist/cart icons plus profile avatar/dropdown. Cart shows item count. The profile menu opens My Account/Profile, My Orders, Settings, and Logout. Every link/action must navigate or perform its promised operation.

Catalogue cards show image, name, availability, rental price/unit, wishlist control, View Details, and Add to Cart. Out-of-stock products show “Out of Stock” and cannot be added. Low inventory communicates “Only X left.” Build graceful no-results/no-products states and pagination if the displayed result set warrants it.

Search dynamically matches name, category, brand, and description. The filter sidebar supports all available brands, multi-select colors, duration (all, 1 month, 6 months, 1 year, 2 years, 3 years), and a working price range slider. Filters update the visible product result set immediately and Clear Filters resets all criteria.

## 9. Product selection and rental calculations

Product detail shows a large image, title, rating, rental price/unit, security deposit, availability, description, specifications, rental period controls, variants, quantity controls, Add to Cart, and Rent Now. Products with variants (for example laptop brand/RAM/storage/color; camera brand/lens/color; sofa color/size) must open a Configure modal before they can be added. Required choices must be validated. Rent Now adds/configures then proceeds logically toward checkout.

Support hourly, daily, weekly, and monthly rentals. Let the customer choose start and end date/time, forbid past starts and end-before-start, calculate duration, and calculate price based on the selected pricing unit and quantity. Simulate period availability from stored rental orders; unavailable stock for a selected window cannot be booked.

Place calculation logic only in reusable utility functions:

```text
calculateRentalDuration()
calculateRentalPrice()
calculateSecurityDeposit()
calculateLateFee()
calculateDiscount()
calculateTotal()
calculateRefund()
```

For late returns, use the configured unit-specific rate and grace period. Refund equals deposit minus late fee, never below zero. Clearly display the example logic: rental ₹5,000 + deposit ₹2,000 charges ₹7,000; on-time return refunds ₹2,000; ₹500 late fee refunds ₹1,500.

## 10. Cart and checkout

Cart rows show image, name, chosen variants, rental period, quantity, rental price, security deposit, and subtotal. Quantity controls validate stock/positive quantity. Remove and Move to Wishlist work and persist. The order summary always recomputes rental subtotal, delivery charge, coupon discount, deposit, and final total. Support `RENT10` (10%) and `WELCOME20` (20%) demo coupons, and show a useful error for invalid/expired/ineligible coupons.

Checkout has address then payment stages. At address stage the customer chooses Delivery or Store Pickup. Delivery supports selecting an existing address plus add/edit address; pickup displays store location, pickup date, and time. Include billing information with “billing address is same as delivery address”; reveal and validate separate billing fields when unchecked.

Payment stage shows a complete order review by product, period, quantity, rental charges, delivery, discount, deposit, and grand total, with security deposit visually emphasized. Payment fields are mock card number, cardholder name, expiry, CVV, and optional saved-payment checkbox. An Express Checkout modal may include the same card inputs plus billing address/city/country/ZIP. Validate card-like input, show a processing state, and never invoke a real payment provider.

On successful simulated payment: generate order and invoice identifiers; mark payment paid/confirmed and security deposit held; save order/payment/deposit; clear cart; generate notifications; then route to success. The success screen includes customer name, delivery/pickup details, item/rental details, deposit, total, order number, and actions to view order, print/download invoice, and continue shopping. Browser print / print-to-PDF is an acceptable frontend-only invoice download method.

## 11. Customer post-order management

Orders page provides All, Active, Upcoming, Completed, and Cancelled tabs. Each order summarizes ID, products, rental period, state, total, deposit, and creation date; selection opens the detail route. Detail includes items, rental period, delivery/pickup, payment, deposit state (Held, Refunded, Partially Deducted), late fee/refund, and rental status: Confirmed, Ready for Pickup, Picked Up, Active, Return Due, Returned, Completed, or Overdue.

Where a return is allowed, provide a working return action. An on-time return sets status Completed and refunds the full deposit. A late return calculates the fee by the configured hourly/daily/weekly/monthly policy, deducts it, updates the deposit record, and displays deposit, late fee, and refund amount. These operations must update shared state so admin screens reflect them.

Wishlist supports add/remove/move-to-cart and persists. Profile supports avatar upload with a local FileReader preview plus editable first/last name, email, phone, and address. Address management supports create, edit, delete, select default, and fields for name, address, city, state, country, ZIP, and phone.

The invoice view must contain company logo/name, invoice and order numbers, customer and billing address, rental products/period, subtotal, discount, delivery, deposit, grand total, payment status, and date; it must offer Print Invoice and Download Invoice actions.

## 12. Admin application and operational behavior

Admin uses a clearly separate responsive layout: sidebar links for Dashboard, Products, Rentals, Orders, Customers, Pickups, Returns, Security Deposits, Pricing, Rental Periods, Coupons, Quotations, Analytics, and Settings; a top bar with search, notifications, profile, and logout. The mobile sidebar is a drawer.

Dashboard KPI cards must derive from stored data, not fixed figures: Active Rentals, Rentals Due Today, Upcoming Pickups, Upcoming Returns, Overdue Rentals, Rental Revenue, Security Deposits Held, and Late Fee Collection. Tables for today’s rentals, upcoming pickups, upcoming returns, overdue rentals, and recent orders contain customer, product, period, status, amount, and a working action/view path.

Product management displays a table/grid containing image, name, category, brand, price, stock, availability, and functional View/Edit/Delete actions. Add and edit product forms support name, category, brand, description, image, stock, hourly/daily/weekly/monthly prices, deposit, availability, and dynamically addable/removable variants (color, size, brand, manufacturer). Delete requires a confirmation dialog and updates inventory everywhere.

Pricing management maintains price lists/rules. Rental-period management creates/edits hourly, daily, weekly, and monthly periods with name, unit, minimum/maximum duration, late-fee rate, and grace period. Settings persist company name/logo, default deposit, default late fee, grace period, pickup and return settings, currency, and tax percentage.

Customers page shows name, email, phone, order count, active rentals, total spent, status, and a detail view. Orders/rentals views allow inspection and status updates appropriate to the state.

Pickup management is a daily schedule with customer, product, pickup date/time, delivery/pickup method, and Scheduled/Ready/Picked Up/Cancelled statuses. Pickup confirmation changes shared order state; a simple order-ID barcode/QR-style visual is optional.

Returns management provides expected/actual return, product condition, damage, missing accessories, late fee, deposit, and refund. Its inspection modal offers Good, Damaged, Missing Accessories, and Needs Repair. Confirmation must update stock, fee/deposit/refund, order status, and optionally repair-required state.

Deposit management lists customer, order, deposit amount, payment/current status, late fee, and refund; View, Refund, and Deduct Late Fee work. Valid statuses are Pending, Held, Partially Refunded, and Refunded. Automatic overdue detection uses rental dates, and admins can settle returns subject to configured maximum late fee and grace period.

Coupon management supports create/edit/delete and enable/disable, with code, discount type/value, minimum order, maximum discount, expiry, usage limit, and status. Checkout calculation respects those conditions. Quotation management supports templates (name, header, footer, terms, conditions) and offline-customer quotations with Draft, Sent, Accepted, Rejected, and Converted statuses. Accepted quotes can become an invoice, payment/deposit record, and rental.

Analytics calculates total revenue, rentals, average rental value, active/completed/overdue rentals, late-fee revenue, and deposits held. Add simple CSS/SVG/HTML visualizations for revenue trend, rental-status distribution, product utilization, and late-return statistics; do not add a large chart dependency. Notifications should be derived/generated from relevant local state: upcoming return, overdue rental, payment success, pickup schedule, and deposit refund.

## 13. Shared UI, feedback, and failure handling

Use a small reusable component set rather than duplicating patterns: navbar/footer, product card/grid, filter/search controls, modal/confirm dialog, toast, input/select/button/badge, protected route, cart item/order summary, address/payment forms, configuration modal, admin sidebar/header, KPI card, data table, and status badge.

All forms require friendly client-side inline validation beyond browser `required`: required values, valid email, password rules/match, date range, payment values, address, quantity, variants, and coupon validation. Add realistic loaders/skeleton/spinner states for authentication, product loading, admin mutations, and payment. Toast variants are success, error, warning, and info; examples include Product added to cart, Coupon applied, Invalid coupon, Login successful, Product updated, Order placed successfully, and Security deposit refunded.

Provide polished empty states with useful calls-to-action for cart, wishlist, orders, search, products, overdue rentals, pickups, and returns. Avoid crashes when a product/order is missing or storage is corrupted. Do not use `eval`, unsafe HTML injection, or imply that frontend-only credentials/payment are secure production systems.

## 14. Acceptance checklist

Before handoff, verify the project installs and starts with no extra setup, no import/undefined-variable errors, all declared routes work, and state survives a browser refresh. Manually exercise login, signup, logout, search/filter, product details/variants, cart, coupon, checkout, payment/order creation, invoice, order history, wishlist, profile/address CRUD, admin login/dashboard/product CRUD, rental/pickup/return workflows, deposit/late-fee/refund calculations, role protection, responsive layout, and every visible button. There must be no TODOs, dead controls, “coming soon” messages, pseudo-code, or static-only flows.


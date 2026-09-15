# Cenexa Billing System

A manager-demo billing application for Cenexa.

## Team
- Developer 1: Darshan
- Developer 2: [Add name]
- UI/UX Designer: [Add name]

## About
This project is an independently built demo inspired by the workflow and feature ideas observed in a separate reference application. It does not use the reference project's branding, business data, or source code.

## Demo features
- Dashboard with sales and inventory summary
- New bill / POS workflow
- Product catalogue and stock
- Customer list
- Sales report
- GST, discount and payment calculations
- Printable tax invoice
- Cenexa branding
- Camera barcode scanner with a live scan frame
- Code 128, EAN-13, EAN-8, UPC-A, UPC-E, QR Code, Code 39 and ITF decoding
- Manual barcode fallback when camera access is unavailable
- Product lookup by `barcode` or `sku`
- Duplicate-scan suppression and audio/visual success feedback

## Barcode scanner setup

The scanner uses ZXing's browser implementation rather than relying only on the experimental `BarcodeDetector` browser API. Install the new packages before running the app:

```bash
npm install
npm run dev
```

Camera scanning requires a secure context: use HTTPS in production, or `localhost` during local development. The browser asks the user for camera permission; the app does not upload camera frames to a server.

### Product data contract

Each product can contain a `barcode` field:

```ts
{
  id: 7,
  name: 'Example Product',
  sku: 'SKU-007',
  barcode: '8901234567890',
  category: 'General',
  price: 499,
  stock: 20,
  gst: 18
}
```

When a scan succeeds, the billing page looks for an exact match against `barcode` or `sku`. If a match is found, the product is added to the current invoice and its quantity is incremented on repeated scans. If no match is found, the scanned value is placed in the product search field so the cashier can resolve it.

### Connecting a real database

The current repository is a frontend demo and stores data in React state. For production, replace the `products` state with an API-backed query such as:

`GET /api/products/barcode/:value`

Return the product record and then call the same `add(product)` flow. Do not trust price, GST or stock values supplied by the browser when creating the final invoice; re-read the product and stock on the server and perform the billing transaction atomically.

## Scanner UX

The scanner modal intentionally follows the supplied reference video's main interaction pattern: dark camera modal, high-contrast gold border, camera selector, scan frame with animated red guide line, status feedback, and a manual-entry fallback.

## Run locally
1. Install Node.js (LTS recommended).
2. Open this folder in a terminal.
3. Run `npm install` so the new ZXing packages are installed and `package-lock.json` is refreshed.
4. Run `npm run dev`.
5. Open the local URL shown by Vite.
6. Open **New Bill → Scan** and allow camera access.

For deployment, serve the site over HTTPS and configure your hosting platform's permissions/security policy to allow camera use on the site's own origin.

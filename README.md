# QRPower

A free, no-frills QR code generator that runs entirely in your browser. No account, no watermark, no limits.

Live: [mardif.github.io/QRPower](https://mardif.github.io/QRPower/)

---

## What it does

You pick a content type, fill in the data, style the code however you like, and download it. That's it.

**Supported content types:**
- URL
- Plain text
- WiFi credentials (scan to connect)
- Email address
- Phone number
- vCard (name, organization, phone, email — scan to save as contact)

**Customization:**
- Dot style, corner shape, overall shape (square or circle)
- Solid color or linear gradient for the foreground
- Custom background color
- Quiet zone (margin) control
- Logo overlay — upload a file or paste a URL, with position and size control

**Export:**
- PNG, JPEG, WebP at 256 / 512 / 1024 / 2048 px
- SVG (vector, infinitely scalable)
- Copy to clipboard

---

## Why

Most online QR generators are free until they're not — resolution limits, watermarks, or a paywall after the first download. This one has no backend and no business model. It does one thing and stores nothing.

---

## Run locally

```bash
npm install
npm run dev
```

Requires Node 18+. Opens at `http://localhost:5173`.

---

## Tech

Built with React and [qr-code-styling](https://github.com/kozakdenys/qr-code-styling). No backend. Deployed on GitHub Pages via GitHub Actions.

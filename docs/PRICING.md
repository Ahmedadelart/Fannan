# Plans and pricing

The numbers live in `config/plans.json`. This file explains them.

## Plans

**Free (forever)**
- 8 projects
- `yourname.fannan.net`
- every theme and block
- Available-for-work badge and contact form
- stats for 30 days
- a small "Made with Fannan" footer credit

**Pro (prepaid)**
- unlimited projects
- your own domain with SSL
- much more storage
- password pages and a full-site password
- full stats (90 days, referrers, countries)
- no footer credit

There's no Studio plan for now.

## Prices

Paymob doesn't do recurring subscriptions yet, so Pro is **paid once for a fixed period**. Nothing renews automatically.

| Pro | Egypt (EGP) | Everywhere else (USD) |
|---|---|---|
| 3 months | 450 EGP (150 / month) | $24 ($8 / month) |
| 6 months | 800 EGP (≈133 / month) | $42 ($7 / month) |
| 12 months | 1,350 EGP (≈112 / month) | $72 ($6 / month) |

**Why these numbers**
- **USD:** Carbonmade charges $9.99, $14.99 and $24.99 a month, with about 20% off yearly, and has no free publishing plan. ArtStation Pro starts at $9.95 a month. Fannan Pro at $6–8 a month is clearly cheaper, still comfortably profitable (hosting costs well under $1 per Pro user a month), and Free actually publishes.
- **EGP:** set for Egyptian incomes rather than converted (at ~52 EGP/$ the USD price would be 300–400 EGP a month). 112–150 EGP a month is in the range of a streaming subscription.

## Rules

- **Currency:**
  - Chosen from the visitor's country: Cloudflare's `CF-IPCountry` header, where `EG` means EGP and everyone else gets USD.
  - It's shown on the pricing page, in Settings and at checkout.
  - It's locked once a payment starts.
- **Charging USD through Paymob:** Paymob in Egypt settles in EGP. Until Ahmed confirms whether his account can charge in USD, charge international customers the EGP equivalent of the USD price at that day's rate (stored on the order), and show "Your bank may show this as about X EGP".
- **Storage:**
  - Never advertise the Free storage number on the marketing site. It appears only as a usage meter in the dashboard.
  - Internally: Free 1 GB, Pro 50 GB.
  - Show the meter calmly ("You've used 40% of your space"), and only warn at 80% and above.
- **Video:** long videos are YouTube or Vimeo links only. Uploads are limited to short loops (MP4, up to 30 seconds and 50 MB) and GIFs. There's no video hosting.
- **Reminders:**
  - Email and a dashboard banner 14 days before, 3 days before, and on the day Pro ends.
  - The email has a one-click "Add more time" link.
- **Stacking:** buying again while Pro is active adds the new months after the current end date.
- **When Pro ends:**
  - There's a 7-day grace period.
  - Then the site moves to Free: projects beyond 8 become hidden (not deleted, and they come back when Pro returns), the custom domain redirects to `yourname.fannan.net`, password pages become hidden, and the footer credit returns.
  - **Nothing is ever deleted** because a payment ended.
- **Refunds:** within 14 days if the site wasn't published on a custom domain. Ahmed can override this from the admin page.
- **Launch offer (optional, Ahmed's call):** the first 100 Pro buyers, or ART GYM beta artists, get 12 months for the 6-month price. This lives in config, not code.

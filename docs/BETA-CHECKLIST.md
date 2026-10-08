# Beta checklist (sign-off before inviting the first artists)

Tick each line when you're happy. Anything marked **You** needs Ahmed; the rest Claude Code has already checked and can show you.

## 1. Read it like a visitor (You, ~20 minutes)
- [ ] Homepage in English: https://fannan.net, and in Arabic: https://fannan.net/ar. Do the words sound like Fannan? Anything to change?
- [ ] Pricing, Help, Examples, Contact: https://fannan.net/pricing, /help, /examples, /contact (and the /ar versions).
- [ ] On your phone too: open the homepage, scroll to the end, tap "Claim your name".

## 2. Legal (You + a lawyer)
- [ ] Terms, Privacy and Content policy (https://fannan.net/terms, /privacy, /content-policy) reviewed by a lawyer. They name Big Cat Animation LLC as the operator. Send Claude Code any changes; it updates both languages.

## 3. A real artist's first day (You, ~15 minutes, on your phone)
- [ ] Sign up with an email you don't use for Fannan yet (for example a Gmail "+beta" address).
- [ ] The welcome email arrives in the inbox (not spam).
- [ ] Add 2–3 real projects with credits, publish. The "Your site is live" email arrives.
- [ ] From another phone or browser, open the site and send a message through the contact form. The "first message" email arrives, and it's in Messages.
- [ ] Stats show the visit within a minute.
- [ ] Settings → Account → delete the test account (it goes for good after 14 days).

## 4. Money
- [ ] Decide: open the beta on Free only (and give Pro to beta artists from Admin → Give Pro), or connect Paymob first. Either works.
- [ ] Launch offer: on or off? (12 months for the price of 6 for the first 100 buyers; it's a switch in config, Claude Code flips it.)
- [ ] When ready to take payments: Paymob test keys (10 minutes, Claude Code walks you through it), a test purchase from Egypt and from abroad, then the live keys.

## 5. Running it (checked by Claude Code)
- [x] Daily database backups, kept 14 days.
- [x] The nightly job runs at 3:00 Cairo time (Pro reminders, moving lapsed Pro sites to Free, deleting closed accounts).
- [x] Uptime checks every 5 minutes on fannan.net, app.fannan.net and an artist site; an email to fannan.team@gmail.com if one is down for 5 minutes.
- [x] An email to fannan.team@gmail.com when the server logs an error (at most one an hour). Details in Google Cloud → Error Reporting.
- [x] Load test: an artist site handled about 43 page views a second with typical responses in 0.4 s.
- [ ] **You:** check the budget alert still exists (Google Cloud → Billing → Budgets & alerts).
- [ ] **You:** if you'd like to reply to people as hello@fannan.net from Gmail, ask Claude Code (10 minutes).

## 6. People
- [ ] Pick the first artists to invite (ART GYM beta?). Ask who agrees to be shown on the Examples page; you can feature them yourself from Admin → Manage → Show on Examples.
- [ ] Reports: anything reported lands in Admin → Reports with a note to support@fannan.net. Decide who checks it, and how often.

## Not in the beta (coming after launch)
WhatsApp alerts, importing from ArtStation/Behance, Fannan search, sites in both English and Arabic at once, custom code in <head>, the final vector logo.

# UNM Archery Club website

Training-session booking for the University of Nottingham Malaysia Archery Club.
Students sign up with their student ID and uni email, members book for free, and
non-members book with single or full-day passes.

This is the **base** of Phase 1: accounts, the member check, Home, and Sessions
with booking and cancelling. Top-up, approvals, duty and attendance come next.

Built with Next.js 16, Supabase (database, login, email codes) and Netlify (hosting).
All three have free plans that are enough for the club.

## One-time setup

### 1. Supabase (database)

1. Create a free project at [supabase.com](https://supabase.com), region **Singapore**.
2. Open **SQL Editor**, paste all of [`supabase/migrations/0001_base.sql`](supabase/migrations/0001_base.sql) and click **Run**.
   Then do the same with each later file in [`supabase/migrations/`](supabase/migrations/), in number order.
3. **Authentication > Sign In / Providers > Email**: keep Email on and "Confirm email" on.
4. **Set up the club Gmail as the sender.** Supabase only lets you edit email templates
   once you use your own sender, and its default emails send a link, not the code the
   site asks for. In the club Gmail, turn on 2-Step Verification, then create an
   [app password](https://myaccount.google.com/apppasswords). In **Authentication >
   Emails > Set up SMTP**: sender and username = the club Gmail address, sender name
   `UNM Archery Club`, host `smtp.gmail.com`, port `465`, password = the app password.
5. **Authentication > Emails > Templates**: in both **Confirm signup** and **Magic Link**,
   switch the body to **Source** and replace it with:

   ```html
   <h2>Your UNM Archery Club code</h2>
   <p>Enter this code on the website: <strong>{{ .Token }}</strong></p>
   <p>It expires in 1 hour. If you didn't ask for it, you can ignore this email.</p>
   ```

6. **Project Settings > API Keys**: you'll need the **Project URL**, the
   **publishable key** and a **secret key** in step 2.

### 2. Netlify (hosting)

1. At [netlify.com](https://netlify.com), **Add new project > Import an existing project > GitHub**, pick this repository.
2. Build settings come from [`netlify.toml`](netlify.toml) in this repository (build command `npm run build`, publish directory `.next`, Node 22), so the dashboard's build fields don't matter.
3. Under **Environment variables**, add (see [`.env.example`](.env.example)):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
   | `SUPABASE_SECRET_KEY` | Supabase secret key (keep private) |
   | `MEMBERS_SYNC_SECRET` | any long random string you make up |

4. Deploy. Then in Supabase, **Authentication > URL Configuration**, set **Site URL** to the Netlify address.

### 3. Make yourself President

Sign up on the website, then run this in the Supabase SQL Editor with your student ID:

```sql
insert into permissions (user_id, permission)
select id, 'owner' from profiles where student_id = '20xxxxxx';
```

### 4. Sync the membership form

Follow the steps at the top of [`scripts/members-sync.gs`](scripts/members-sync.gs).
After that, every new form response reaches the website within seconds, and anyone
whose student ID **and** email match the form becomes a Member automatically.

Students who show as non-members can tap **Request member check** on Home. The
request appears under **Exco > Members** for anyone with the `manage_members`
permission (the President has it). Approving makes them a member; rejecting shows
them your reason. This needs [`supabase/migrations/0002_member_requests.sql`](supabase/migrations/0002_member_requests.sql):
run it once in the SQL Editor, after `0001_base.sql`.

To give another exco member that permission:

```sql
insert into permissions (user_id, permission)
select id, 'manage_members' from profiles where student_id = '20xxxxxx';
```

### Starter accounts for members (no email code needed)

Needs [`supabase/migrations/0003_starter_accounts.sql`](supabase/migrations/0003_starter_accounts.sql) run once, and the member list synced (step 4).
Open **Exco > Accounts** and tap **Create starter accounts**. Each member on the list with a uni
email gets an account whose first password is the first word of their name on the form, in
lowercase, followed by their student ID (Alex Tan, 20512034 → `alex20512034`). They must choose
their own password at first login, and a starter password stops working after
`starter_password_days` (14) days, after which they use **Forgot password**. The page has a
ready-made message to post in the members' WhatsApp group. If more than about 60 accounts are
waiting, tap the button again until none are left.

Anyone who knows a member's first name and student ID can guess the starter password, so
ask members to log in soon after you post the message.

### Giving a non-member passes (until the top-up page is built)

```sql
insert into pass_ledger (user_id, kind, delta, reason, note)
select id, 'single', 3, 'adjust', 'paid cash to treasurer' from profiles where student_id = '20xxxxxx';
-- kind: 'single' or 'full'
```

## Rules the base already enforces

- Tuesdays and Thursdays, 4–5, 5–6 and 6–7pm, 20 archers per slot; non-members at most 25% (5).
- Booking opens every **Monday at 9am** for the whole following week.
- Members book free and can cancel any time before the slot starts.
- Non-members use a **single pass** (one slot) or a **full-day pass** (all three slots of a day).
  A single pass comes back if cancelled 2 hours or more before; a full-day pass comes back only when the whole day is cancelled in time.
- Each booking stores the archer's equipment choice (hand and draw weight, or own bow).

Every number above lives in the `settings` table, so it can change without code. The
Settings page in Phase 1 will edit it; until then, change it in Supabase **Table Editor > settings**.

## Security

- Row Level Security is on for every table. Archers can read only their own profile,
  bookings and passes; bookings and passes change only through the database functions.
- The secret key is used only on the server (finding a student's email at login, and the member sync).
  Never put it in code or in a `NEXT_PUBLIC_` variable. [`0004_server_grants.sql`](supabase/migrations/0004_server_grants.sql)
  gives it the table access it needs; without it, every login says "Student ID or password is incorrect".
- `npm run test:db` runs the database rules, including the security checks, against a local Postgres.

## Working on the code

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
npm run test:db              # database tests
npm run lint
```

| Path | What's there |
| --- | --- |
| `supabase/migrations/` | Database tables, booking rules and security |
| `supabase/tests/` | Database tests (run in PGlite) |
| `src/app/(auth)/` | Sign up, email code, log in, password reset |
| `src/app/(club)/` | Signed-in pages: Home, Sessions, and Exco > Members (member check requests) |
| `src/app/api/members/sync/` | Receives the membership list from Google Sheets |
| `src/proxy.ts` | Keeps the login session fresh and protects pages |
| `scripts/members-sync.gs` | Google Apps Script for the membership form |

# MDA Contact Information Validation Portal

Confirm or update the official contact details and key role numbers for every
Government of Barbados **Ministry**, and the **departments and agencies**
beneath it.

Ministry representatives review what is currently on file, correct anything
that is wrong, and submit. A coordinator then reviews each submission and
publishes the approved directory. It is an alpha prototype for user testing,
not a production system.

## What it does

**Validate Information** (representative view)
- Browse ministries and open the department or agency you represent — the
  directory nests three levels (Ministry → body → facility).
- For each field — telephone, email, address, and the directory of key role
  numbers — confirm it as correct or supply a correction.
- Affirm the details are accurate and submit for review.
- **Add a missing sub-component:** if a department or facility that should
  exist is not listed, propose it. The proposal goes into the review queue for
  a coordinator to approve, which adds it to the directory.
- A per-organisation progress rollup (e.g. `3/10`) shows how many entries are
  still outstanding.

**Coordinator Dashboard** (reviewer view, @govtech.bb sign-in required)
- Review submitted entries side by side with what was on file, with a
  change summary and a full audit trail (submitted → approved / returned).
- Approve an entry — which writes the change straight into the live directory
  for everyone — or return it for another look.
- Edit the on-file details of any record, and add or remove sub-components
  under a ministry.
- Export the directory as JSON or CSV.

**Deep links** — link a representative straight to their organisation with a
URL hash or query parameter:

```
https://…/#mda=ministry-of-health-and-wellness
https://…/?mda=ministry-of-health-and-wellness
```

## Design system

The interface uses the **[gov.bb design system](https://design-system.gov.bb)**
([`govtech-bb/govbb-design-system`](https://github.com/govtech-bb/govbb-design-system))
design tokens: the Figtree typeface, the ultramarine brand + gold accent, the
teal / green / red status colours, and the 4px control radius. The tokens are
declared once on the root element as CSS custom properties and drive every
component.

## Tech

- **React** single-file component — the default export of
  [`mda-validation-portal.jsx`](mda-validation-portal.jsx).
- **Supabase** for storage and coordinator auth, reached directly over its REST
  and Auth endpoints with `fetch` — no client library.
- Styling is plain CSS (design tokens as custom properties) injected by the
  component — no CSS framework required.
- The interface is entirely text-based — there are no icons.

## How data flows

- **Directory** (`kv` table) — the official contact records. The public key can
  **read** it; only a signed-in `@govtech.bb` coordinator can **write** it.
- **Submissions queue** (`submissions` table) — a representative's submission is
  **appended** here (the public key can insert but not read or overwrite). It
  never touches the live directory directly.
- A coordinator signs in, reviews the queue, and **approves** a submission —
  that's what writes the change into the directory for everyone.
- **localStorage** is kept as an offline cache of the directory.

## Locking down the database (row-level security)

Run this once in the Supabase **SQL editor**:

```sql
-- Submissions queue: anyone may add; only govtech.bb admins may read/act.
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  org_id text, org_name text, org_slug text, kind text, ref text,
  status text not null default 'pending',
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table submissions enable row level security;
create policy "submissions public insert" on submissions for insert to anon, authenticated with check (true);
create policy "submissions admin read"   on submissions for select to authenticated using ((auth.jwt() ->> 'email') like '%@govtech.bb');
create policy "submissions admin update" on submissions for update to authenticated using ((auth.jwt() ->> 'email') like '%@govtech.bb') with check ((auth.jwt() ->> 'email') like '%@govtech.bb');

-- Directory: public reads; only govtech.bb admins write.
drop policy if exists "kv anon write"  on kv;
drop policy if exists "kv anon update" on kv;
create policy "kv admin insert" on kv for insert to authenticated with check ((auth.jwt() ->> 'email') like '%@govtech.bb');
create policy "kv admin update" on kv for update to authenticated using ((auth.jwt() ->> 'email') like '%@govtech.bb') with check ((auth.jwt() ->> 'email') like '%@govtech.bb');
-- (keep the existing "kv anon read" select policy)
```

## Admin sign-in (Supabase Auth)

Coordinators sign in with their **@govtech.bb** account. The domain is enforced
by the RLS policies above (a non-govtech.bb user can authenticate but can't
read the queue or write the directory).

- **Email + password (active method):** Authentication → Providers → **Email**
  (on by default). A coordinator uses **Create an account** once — entering
  their @govtech.bb email and a password — then signs in with the same details.
- **Google (built in but hidden):** the "Sign in with Google" button is gated
  behind the `GOOGLE_SIGN_IN` flag near the top of `mda-validation-portal.jsx`,
  currently `false`. To enable it, set the flag to `true` and, in Supabase →
  Authentication → Providers → **Google**, paste a Google OAuth client ID +
  secret (from the Google Cloud console; set the consent screen to *Internal*
  so only govtech.bb accounts can use it, and add
  `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect
  URI).

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are set near the top of
`mda-validation-portal.jsx`. Until the SQL above is run, admin actions won't be
able to write; until a provider is configured, sign-in won't succeed.

### Forgotten password

A coordinator who forgets their password can reset it themselves — no admin
involvement:

1. **Coordinator dashboard → Forgotten your password?** → enter the @govtech.bb
   email → **Send reset link**. This calls Supabase `/auth/v1/recover` with a
   `redirect_to` back to the portal. The confirmation message is deliberately
   generic ("If that account exists…") so it never reveals which emails have
   accounts.
2. The emailed link returns to the portal with a `type=recovery` token, which
   opens a **Set a new password** screen. Saving updates the password and signs
   the coordinator straight in.

For the emailed link to return to the portal, the live URL must be registered
in Supabase → Authentication → **URL Configuration**:

- **Site URL:** `https://govtech-bb.github.io/mda-directory/`
- **Redirect URLs:** add the same URL to the allow-list.

Supabase honours a `redirect_to` only when it matches the Site URL or a
Redirect URLs entry; otherwise it falls back to the Site URL. Keep both pointed
at the live portal (update them if the site ever moves to a custom domain).

## Run locally

The repository is a [Vite](https://vite.dev) app. `src/main.jsx` renders the
`mda-validation-portal.jsx` component; `index.html` is the entry point.

```bash
npm install
npm run dev
```

`npm run build` produces the static site in `dist/`, and `npm run preview`
serves that build. Deployment to GitHub Pages runs automatically on every push
to `main` (see `.github/workflows/`), with Vite's `base` set to
`/mda-directory/`.

## Configuration

Set near the top of `mda-validation-portal.jsx`:

| Constant             | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `SUPABASE_URL`       | Supabase project URL (the directory and submissions live here).         |
| `SUPABASE_ANON_KEY`  | Supabase publishable (public) key — safe to ship; RLS does the guarding.|
| `ADMIN_EMAIL_DOMAIN` | Email domain allowed to act as a coordinator (`govtech.bb`).            |
| `GOOGLE_SIGN_IN`     | Show the "Sign in with Google" button (`false` until OAuth is set up).  |
| `KEY`                | Storage key for the directory records (also the `kv` row key).          |
| `SESSION_KEY`        | localStorage key holding the signed-in coordinator's session.          |

## Source data

Ministries and their published contact details and role directories are
imported from **alpha.gov.bb / gov.bb**. Departments and agencies carry
contact details where they were pre-filled; the rest start blank for the
representative to supply.

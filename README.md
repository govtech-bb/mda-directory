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
- Browse ministries and open the department or agency you represent.
- For each field — telephone, email, address, and the directory of key role
  numbers — confirm it as correct or supply a correction.
- Affirm the details are accurate and submit for review.
- A per-organisation progress rollup (e.g. `3/10`) shows how many entries are
  still outstanding.

**Coordinator Dashboard** (reviewer view, access-code protected)
- Review submitted entries side by side with what was on file, with a
  change summary and a full audit trail (submitted → approved / returned).
- Approve an entry or return it for another look.
- Publish the approved set: download `mda-contacts.json`, or open a GitHub
  pull request that commits the directory to a target repository.

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
- **[lucide-react](https://lucide.dev)** for icons.
- Styling is plain CSS (design tokens as custom properties) injected by the
  component — no build step or CSS framework required.
- State is entirely text-based — there are no icons.

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

- **Google (recommended, since the team uses Google Workspace):** in Supabase →
  Authentication → Providers → **Google**, enable it and paste a Google OAuth
  client ID + secret (from Google Cloud console; set the consent screen to
  *Internal* so only govtech.bb accounts can use it, and add
  `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect
  URI). The app's "Sign in with Google" button then works.
- **Email + password:** Authentication → Providers → **Email** (on by default).
  Coordinators use "Create an account" once, then sign in.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are set near the top of
`mda-validation-portal.jsx`. Until the SQL above is run, admin actions won't be
able to write; until a provider is configured, sign-in won't succeed.

## Run locally

The repository holds the component only. To preview it, drop it into a minimal
React app — for example with [Vite](https://vite.dev):

```bash
npm create vite@latest mda-portal -- --template react
cd mda-portal
npm install lucide-react
```

Copy `mda-validation-portal.jsx` into `src/`, then render it:

```jsx
// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./mda-validation-portal.jsx";

createRoot(document.getElementById("root")).render(<App />);
```

```bash
npm run dev
```

## Configuration

Set near the top of `mda-validation-portal.jsx`:

| Constant      | Purpose                                                        |
| ------------- | ------------------------------------------------------------- |
| `ACCESS_CODE` | Shared sign-in code for the Coordinator Dashboard.            |
| `KEY`         | Storage key for the saved records.                            |
| `SHARED`      | Whether records are read from / written to the shared store.  |

Publishing to GitHub requires the target repository as `owner/name` and a
GitHub access token with `repo` permission, both entered in the Publish panel.
The token is used only for that request from the browser and is never stored.

## Source data

Ministries and their published contact details and role directories are
imported from **alpha.gov.bb / gov.bb**. Departments and agencies carry
contact details where they were pre-filled; the rest start blank for the
representative to supply.

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

## Saving changes

Records are persisted in layers, so the app works in any deployment:

1. **Supabase** (shared) — when configured, every browser reads and writes the
   same records, so a coordinator sees submissions made on any device.
2. **localStorage** (per-device) — always kept as an offline cache, so changes
   survive a reload even before a shared database is set up.
3. A host `window.storage` bridge, if the environment provides one.

### Enable the shared Supabase database

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, create the key-value table and policies (the exact SQL
   is in the comment block at the top of `mda-validation-portal.jsx`).
3. Paste the project **URL** and **anon/public key** into `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` near the top of `mda-validation-portal.jsx`.

Until those are filled in, the app runs on localStorage alone. The anon key is
safe to ship in client code, but tighten the row-level-security policies before
storing anything sensitive.

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

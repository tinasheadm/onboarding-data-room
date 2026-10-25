# Where the backend plugs in

Nothing here writes to a server. Everything below is a seam left deliberately, with the shape of
what belongs there, so the first real integration is a replacement rather than a rewrite.

---

## 1. The hand-off to the developer portal

**What happens now.** The room appends `?from=dataroom` to the portal URL. The portal sees it,
establishes a session for its demonstration account, and skips its own sign-in.

**What it stands in for.** A short-lived token minted by the room and verified by the portal:

```
GET /onboarding/{room}/portal-token
  -> { "token": "...", "expires": "2026-10-24T11:04:00Z", "subject": "marcus.bell@..." }

https://portal.financialconnect.example/?handoff=<token>
```

The portal verifies the signature, reads the subject, and starts a normal session for that
person. The token is single use and lives for about a minute.

**Why it matters that this is replaced.** A query parameter anybody can type is not an
authentication boundary. Today it grants nothing a reader could not get by using the portal's own
sign-in, so the exposure is nil, but that stops being true the moment the portal shows anything
merchant-specific.

**Where to change it.**

- This repository: `PORTAL` at the top of `assets/app.js`, and `portalUrl()` directly below it.
- The portal: the `from=dataroom` block in `assets/app.js`, inside the `DOMContentLoaded`
  handler, marked with a comment saying to replace that block and not the sign-in around it.

---

## 2. Sign-in and the code

**What happens now.** The address is checked against `PEOPLE` in `assets/data.js`. Any six digits
are accepted. The session is a `localStorage` entry with a timestamp.

**What belongs there.**

```
POST /onboarding/{room}/auth/request   { "email": "..." }
  -> 204 always, whether or not the address is in the room

POST /onboarding/{room}/auth/verify    { "email": "...", "code": "123456" }
  -> { "session": "...", "person": { "id": "...", "name": "...", "side": "merchant" } }
  -> 401 on a wrong or expired code
```

The request endpoint returning 204 regardless is deliberate and the client already behaves that
way: the sign-in form must not become a way to find out who is working on a deal. The one place
the current build departs from this is that it tells an unknown address it is unknown, which is a
demonstration convenience. Fix that at the same time as wiring the endpoint.

Rate limiting, attempt counting and lockout all belong on the server. There is nowhere to put
them here.

---

## 3. The checklist

**What happens now.** Seeded in `ITEMS`, with changes stored as overrides under `dataroom:items`.

**What belongs there.**

```
GET   /onboarding/{room}/items
PATCH /onboarding/{room}/items/{id}    { "status": "done" }
  -> the item, with server-assigned completedAt and elapsed
```

`elapsed` is a server concern. It counts working hours from assignment, which needs a calendar
and a timezone, and it must not be computed from the reader's clock.

**The next phase.** Each item also appears as a task in ClickUp, and ticking it in either place
closes both. That is a webhook in each direction and an identifier on the item.

---

## 4. Contacts and the gate

**What happens now.** `PEOPLE` carries the workstreams. Removals are stored under `dataroom:removed`.
`gateOpen()` is the rule.

**What belongs there.**

```
GET    /onboarding/{room}/contacts
POST   /onboarding/{room}/contacts     { "name", "email", "role", "workstream", "org" }
DELETE /onboarding/{room}/contacts/{id}
POST   /onboarding/{room}/open         opens the room to the merchant
```

The gate must be enforced on the server as well. `POST /open` returning 409 when a workstream has
nobody named is the real rule; the disabled button in this build is a courtesy on top of it.

Adding a contact is what sends them their sign-in link, so the create endpoint owns that email.

---

## 5. Documents

**What happens now.** `DOCS` in `assets/data.js` describes versions and approvals. Nothing
uploads or downloads.

**What belongs there.**

```
GET  /onboarding/{room}/documents/{key}
POST /onboarding/{room}/documents/{key}/versions    multipart
POST /onboarding/{room}/documents/{key}/approve
```

Files stay in our own storage with their full history. One exception, and it is load-bearing:
the marketing guidelines live where the marketing team writes them, and the room resolves the
current version at read time rather than keeping a copy. That is why `DOCS.marketing.held` is
`them` and everything else is `us`. Whatever replaces this must preserve the distinction, or the
guidelines go stale the first time marketing edits them.

---

## 6. Closure

**What happens now.** A flag under `dataroom:closed`.

**What belongs there.**

```
POST /onboarding/{room}/close
  -> renders the trail to PDF and files it
  -> marks the stored files read only in place
  -> revokes every merchant and third party session for this room
```

Closing is not reversible, and the current build's "reopen for the demonstration" control has no
counterpart in a real deployment. The three consequences are listed to the reader before they
close, which should survive into the real thing.

---

## 7. Creating the room

Out of scope for this repository, and the one step the walkthrough is honest about still being
partly manual.

```
POST /onboarding   { "merchant": ..., "signedOn": ..., "owner": ... }
  -> creates the room, seeds the checklist, emails the link to onboarding@financialconnect.example
```

Two of the three steps already run themselves when a deal flips to closed won. Copying the link
onto the merchant account is one paste, until the portal can accept the link over an API.

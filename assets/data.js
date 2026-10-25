/* ==========================================================================
   Onboarding data room, demonstration data
   --------------------------------------------------------------------------
   One fictional merchant, Northfield Credit Union, carried over from the
   walkthrough. Every name here is invented. No real merchant, contact or
   deal appears in this repository, and none should: the same rule the
   developer portal holds to.

   The room is seeded at day 11 of 20, which is the state most of the
   walkthrough shows. Day 0 and the closed state are both reachable from
   here, the first by resetting and the second by finishing the work.
   ========================================================================== */

var ROOM = {
  merchant:        'Northfield Credit Union',
  short:           'Northfield',
  slug:            'northfield',
  signedOn:        '3 March',
  commercialOwner: 'Ray Okafor',
  owner:           'Alicia Moreno',
  targetDays:      20,
  dayNow:          11,
  targetLive:      '31 March',
  link:            'onboarding.financialconnect.example/northfield-credit-union',

  /* The merchant uses an agency for its customer onboarding, so the
     technical workstream has a third party in it. Common enough that the
     contacts model has to carry it rather than treat it as an exception. */
  thirdParty: { name: 'Corva Digital', does: 'runs Northfield’s customer onboarding' }
};

var SUPPORT = {
  mailbox:  'onboarding@financialconnect.example',
  partners: 'financialconnect.example/for-technology-partners'
};

/* ── People ────────────────────────────────────────────────────────────────
   `org` is 'fc', 'merchant' or 'thirdparty'. `side` decides which of the two
   faces of the room somebody sees after signing in: staff get the board,
   everybody else gets their own work. There is one sign-in, not two.
   ────────────────────────────────────────────────────────────────────────── */
var PEOPLE = [
  /* Financial Connect */
  { id: 'alicia', name: 'Alicia Moreno',  role: 'Account Manager',        org: 'fc',
    email: 'alicia.moreno@financialconnect.example',  side: 'staff', workstreams: ['marketing'] },
  { id: 'tom',    name: 'Tom Reyes',      role: 'Integration Specialist', org: 'fc',
    email: 'tom.reyes@financialconnect.example',      side: 'staff', workstreams: ['technical'] },
  { id: 'ravi',   name: 'Ravi Chandra',   role: 'Finance Manager',        org: 'fc',
    email: 'ravi.chandra@financialconnect.example',   side: 'staff', workstreams: ['finance'] },
  { id: 'sonia',  name: 'Sonia Grant',    role: 'Account Director',       org: 'fc',
    email: 'sonia.grant@financialconnect.example',    side: 'staff', workstreams: ['legal'] },

  /* Northfield */
  { id: 'dana',   name: 'Dana Whitmore',  role: 'Controller',             org: 'merchant',
    email: 'dana.whitmore@northfieldcu.example',  side: 'merchant', workstreams: ['finance'] },
  { id: 'owen',   name: 'Owen Pike',      role: 'Accounts Payable',       org: 'merchant',
    email: 'owen.pike@northfieldcu.example',      side: 'merchant', workstreams: ['finance'] },
  { id: 'priya',  name: 'Priya Raman',    role: 'Head of Growth',         org: 'merchant',
    email: 'priya.raman@northfieldcu.example',    side: 'merchant', workstreams: ['marketing'] },
  { id: 'marcus', name: 'Marcus Bell',    role: 'Engineering Lead',       org: 'merchant',
    email: 'marcus.bell@northfieldcu.example',    side: 'merchant', workstreams: ['technical'] },
  { id: 'hana',   name: 'Hana Ito',       role: 'Web Developer',          org: 'merchant',
    email: 'hana.ito@northfieldcu.example',       side: 'merchant', workstreams: ['technical'] },
  { id: 'ben',    name: 'Ben Kessler',    role: 'General Counsel',        org: 'merchant',
    email: 'ben.kessler@northfieldcu.example',    side: 'merchant', workstreams: ['legal'] },
  { id: 'elena',  name: 'Elena Marsh',    role: 'CMO',                    org: 'merchant',
    email: 'elena.marsh@northfieldcu.example',    side: 'merchant', workstreams: ['marketing'],
    watcherOnly: true },

  /* The agency. A link, not an account: Lena can sign in to the technical
     workstream and sees nothing else. */
  { id: 'lena',   name: 'Lena Fowler',    role: 'Implementation Lead',    org: 'thirdparty',
    email: 'lena.fowler@corvadigital.example',    side: 'merchant', workstreams: ['technical'] }
];

/* ── Workstreams ───────────────────────────────────────────────────────────
   The gate: every workstream needs an owner at Financial Connect and at least
   one person at the merchant. `legalNamedAt` records when the fourth one was
   finally filled, because the walkthrough opens on it being empty and the
   board later shows terms coming back from Ben Kessler.
   ────────────────────────────────────────────────────────────────────────── */
var WORKSTREAMS = [
  { id: 'finance',   name: 'Finance',
    covers: 'Billing, bank details and how invoices get paid.' },
  { id: 'marketing', name: 'Marketing',
    covers: 'What publishers may say about you, and the campaign plan.' },
  { id: 'technical', name: 'Technical',
    covers: 'Tracking, conversions and the integration build.' },
  { id: 'legal',     name: 'Legal',
    covers: 'Terms publishers accept at signup, and anything your counsel must see.' }
];

/* ── The checklist ─────────────────────────────────────────────────────────
   Seventeen items. `status` is one of done, active, waiting, idle.
     done     finished, with who and how long it took
     active   somebody is working on it
     waiting  assigned to the merchant and sitting
     idle     not started, no clock running

   `elapsed` is working hours from assignment, pre-computed here rather than
   derived, because this is a demonstration and a live clock would make every
   screenshot different.
   ────────────────────────────────────────────────────────────────────────── */
var ITEMS = [
  { id: 'kickoff-internal', title: 'Internal kick-off', ws: 'marketing',
    who: 'alicia', by: 'ray', byName: 'Ray Okafor', status: 'done', elapsed: '4h',
    at: '3 March, 2:40pm', phase: 'plan',
    what: 'Commercial hands over to onboarding: what was sold, at what rate, and anything promised in the room.',
    how: 'A call between the commercial owner and the account manager. Nothing for the merchant to do.' },

  { id: 'contacts', title: 'Contacts named on both sides', ws: 'marketing',
    who: 'alicia', status: 'done', elapsed: '1d 2h', at: '4 March, 11:15am', phase: 'plan',
    what: 'One owner at Financial Connect and at least one person at Northfield, for all four workstreams.',
    how: 'Filled in on the Contacts page. Nothing merchant-facing opens until all four are named.',
    page: 'contacts' },

  { id: 'room-open', title: 'Data room opened to Northfield', ws: 'marketing',
    who: 'alicia', status: 'done', elapsed: '20m', at: '4 March, 11:35am', phase: 'plan',
    what: 'Each named contact gets a link to their own part of this room.',
    how: 'One click once the contacts gate is satisfied. Each person receives a sign-in link by email.' },

  { id: 'kickoff-external', title: 'External kick-off call', ws: 'marketing',
    who: 'alicia', status: 'done', elapsed: '2d', at: '6 March, 10:00am', phase: 'plan',
    what: 'Introductions, the twenty day shape, and who owns what on both sides.',
    how: 'Scheduled by the account manager once the room is open.' },

  { id: 'marketing-kit', title: 'Marketing kit and finance introduction', ws: 'marketing',
    who: 'alicia', status: 'done', elapsed: '1d 4h', at: '7 March, 3:20pm', phase: 'plan',
    what: 'The brand kit goes over, and finance on both sides are introduced by email.',
    how: 'Sent by the account manager.' },

  { id: 'terms-draft', title: 'Terms drafted and returned', ws: 'legal',
    who: 'ben', status: 'done', elapsed: '4d', at: '9 March, 5:10pm', phase: 'plan',
    what: 'The standard template goes to your counsel, who amends it and sends it back.',
    how: 'Versions are kept here. Every turn is recorded.',
    page: 'terms' },

  { id: 'terms-approved', title: 'Terms approved and published', ws: 'legal',
    who: 'sonia', status: 'done', elapsed: '6h', at: '11 March, 2:14pm', phase: 'plan',
    what: 'The account director signs off the agreed text, which then goes to the Financial Connect portal for publishers to accept at signup.',
    how: 'One approval. The portal decides its own version number; we hand over the agreed text.',
    page: 'terms' },

  { id: 'billing', title: 'Billing and bank details', ws: 'finance',
    who: 'dana', status: 'done', elapsed: '2d 3h', at: '11 March, 4:02pm', phase: 'plan',
    watcher: 'ravi',
    what: 'Escrow account details, tax registration and a billing contact for invoices.',
    how: 'Financial Connect finance emails you the billing summary and you reply to them directly. Come back here and tick this off once that is settled.',
    note: 'Nothing about how this gets done has changed. What changed is that nobody has to ask where it stands.' },

  { id: 'tech-call', title: 'Technical integration call', ws: 'technical',
    who: 'tom', status: 'done', elapsed: '1d', at: '10 March, 11:00am', phase: 'build',
    what: 'Your engineers and ours agree which tracking method fits, and what has to be built.',
    how: 'A call. The integration guide covers everything discussed, so this is a conversation rather than a lecture.',
    page: 'integration' },

  { id: 'third-party-intro', title: 'Financial Connect introduced to Corva Digital', ws: 'technical',
    who: 'tom', status: 'done', elapsed: '3h', at: '12 March, 9:40am', phase: 'build',
    what: 'Where a third party runs part of your customer journey, they need the same technical introduction you got.',
    how: 'An introduction by email, plus the technology partners page. A link, not an account.',
    page: 'integration' },

  { id: 'integration-build', title: 'Integration build at Northfield', ws: 'technical',
    who: 'marcus', status: 'active', elapsed: '3d 5h', phase: 'build',
    what: 'Capture the click identifier, hold it through your application flow, and report the conversion back.',
    how: 'Your engineers build it. The integration guide has the method guides, worked examples and a recommendation wizard.',
    page: 'integration' },

  { id: 'publisher-shortlist', title: 'Publisher shortlist', ws: 'marketing',
    who: 'alicia', status: 'active', elapsed: '1d 6h', phase: 'build',
    what: 'Which publishers we approach first, based on your products and the markets you care about.',
    how: 'Drafted by the account manager, confirmed with your growth lead.' },

  { id: 'touch-base', title: 'Weekly touch-base', ws: 'marketing',
    who: 'alicia', status: 'active', elapsed: 'ongoing', phase: 'build',
    what: 'A standing half hour while the integration is being built.',
    how: 'Runs until go-live, then stops.' },

  { id: 'marketing-guidelines', title: 'Marketing guidelines reviewed', ws: 'marketing',
    who: 'priya', status: 'waiting', elapsed: '5d 2h', phase: 'build',
    watcher: 'elena',
    what: 'What publishers may and may not say about Northfield. Rate claims, logo use, anything your brand team needs to rule on.',
    how: 'Read the current guidelines, then send back anything specific to you.',
    page: 'marketing' },

  { id: 'strategy-call', title: 'Strategy call scheduled', ws: 'marketing',
    who: 'priya', status: 'waiting', elapsed: '3d', phase: 'build',
    what: 'Campaign shape, launch timing and which products lead.',
    how: 'Your growth lead picks a slot.' },

  { id: 'final-test', title: 'Final integration test', ws: 'technical',
    who: 'tom', status: 'idle', phase: 'launch',
    what: 'A real click through a real journey, confirmed landing on our side.',
    how: 'Runs once the build is finished. Both sides watch it together.',
    page: 'integration' },

  { id: 'golive-notice', title: 'Go-live notice to all stakeholders', ws: 'marketing',
    who: 'alicia', status: 'idle', phase: 'launch',
    what: 'Everybody named in this room hears that the programme is live, on the same day.',
    how: 'Sent by the account manager. It is the last thing that happens before the room closes.' }
];

/* ── Documents ─────────────────────────────────────────────────────────────
   `held` says who stores the file. Almost everything is ours. The marketing
   guidelines are the exception, and the exception is the point: that file
   lives where the marketing team writes it, so the room shows whatever is
   current rather than a copy that goes stale.
   ────────────────────────────────────────────────────────────────────────── */
var DOCS = {
  terms: {
    title: 'Terms publishers agree to at signup',
    sub: 'Started from the standard template, assigned to Ben Kessler at Northfield',
    status: 'Approved',
    held: 'us',
    versions: [
      { v: 'v1', file: 'northfield-terms-template.docx', by: 'Financial Connect', on: '5 March' },
      { v: 'v2', file: 'northfield-terms-amended.docx',  by: 'Ben Kessler',    on: '9 March' },
      { v: 'v3', file: 'northfield-terms-final.docx',    by: 'Financial Connect', on: '11 March' }
    ],
    approval: { by: 'Sonia Grant', role: 'Account Director', at: '11 March, 2:14pm' },
    published: 'Published to the Financial Connect portal. Every file here lives in our own storage with its ' +
               'full history. The portal decides its own version number; we hand over the agreed text.'
  },

  marketing: {
    title: 'Marketing guidelines',
    sub: 'Assigned to Priya Raman, watched by Elena Marsh, CMO',
    status: 'In review',
    held: 'them',
    current: { v: 'v4.2', file: 'financial-connect-guidelines.docx',
               note: 'Maintained by our marketing team. You always get the current version.' },
    responses: [
      { v: 'v1', file: 'northfield-brand-notes.pdf', by: 'Priya Raman', on: '14 March' }
    ],
    comment: '“We cannot use the word guaranteed in any rate claim. Two logo lock-ups attached.”'
  }
};

/* ── The integration index ─────────────────────────────────────────────────
   Deliberately thin. These are pointers into the developer portal, not a
   second copy of it: one source, two front doors. Each entry carries the
   portal page it opens, so the link stays correct if the portal reorganises.
   ────────────────────────────────────────────────────────────────────────── */
var INTEGRATION_INDEX = [
  { title: 'Conversion postbacks by webhook', page: 'method-postback',
    blurb: 'Send a server to server call when a conversion completes. Covers the required parameters, ' +
           'the click identifier and how to retry a failed call.' },
  { title: 'Batch file conversions over SFTP', page: 'method-batch',
    blurb: 'Daily file drop for institutions that cannot fire a real time call. File format, naming ' +
           'and the cut-off schedule.' },
  { title: 'First-party pixel', page: 'method-pixel',
    blurb: 'A tag on your confirmation page, for conversions that finish in the browser.' },
  { title: 'Carrying the click identifier across domains', page: 'guide-param-forwarding',
    blurb: 'Required whenever your application form sits on a different host to your landing page. ' +
           'The most common cause of lost attribution.' },
  { title: 'When the data lives in several systems', page: 'guide-sources',
    blurb: 'The normal shape for a bank: the application platform knows one event, the core knows ' +
           'another. Which mechanism for which event, from which system.' },
  { title: 'Server-side attribution', page: 'guide-visitor-token',
    blurb: 'For journeys where a vendor strips query parameters before your form ever sees them.' },
  { title: 'Cookies and consent', page: 'guide-consent',
    blurb: 'What to tell your privacy team, and what happens to attribution when a visitor declines.' },
  { title: 'Testing your integration', page: 'testing',
    blurb: 'The end to end test sequence and how to read the result.' }
];

/* ── Closure ───────────────────────────────────────────────────────────────
   What happens to the record when the room closes. Shown before closing, not
   after, so nobody is surprised by the access being withdrawn.
   ────────────────────────────────────────────────────────────────────────── */
var CLOSURE = [
  { t: 'A PDF of the full trail is filed to SharePoint',
    d: 'Every version, approval, assignment and timestamp.' },
  { t: 'The files stay where they are and become read only',
    d: 'Nothing is copied or moved, so the references in that PDF still resolve years later.' },
  { t: 'Northfield’s contacts lose access to this room',
    d: 'The integration documentation stays open to them through the knowledge base. ' +
       'Nothing they still need goes away.' }
];

/* ── Sign-in ───────────────────────────────────────────────────────────────
   Email and a six digit code. No password, no account to create, no sign-up
   form. The code is accepted on shape rather than value, because this is a
   demonstration and there is no mail server behind it.
   ────────────────────────────────────────────────────────────────────────── */
var AUTH = {
  codeLength:     6,
  codeMinutes:    10,
  resendSeconds:  30,
  sessionHours:   24
};

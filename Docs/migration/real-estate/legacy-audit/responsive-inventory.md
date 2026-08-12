# Responsive Inventory — Real Estate

Desktop/mobile layout behavior for each audited page.

---

## General Layout System

- Sidebar: fixed left, collapsible (lg:w-64 collapsed → lg:w-16)
- Mobile: sidebar hidden by default, toggled via hamburger
- Content area: `max-w-7xl mx-auto` with responsive padding
- Dark mode: supported via `dark:` Tailwind classes throughout

---

## Dashboard

### Desktop (xl+)
- Metrics: 4–6 column grid
- Properties table: full width with all columns
- Split section: 2-column (text + buttons)
- Revenue chart + Quick stats: 2-column grid
- Revenue chart + Pending actions: 2-column grid

### Mobile
- Metrics: 2-column grid
- Properties table: horizontal scroll
- Charts: full width, responsive container
- Pending actions: stacked list

### Behavior to preserve
- Metric cards with icon + value + label
- Revenue trend AreaChart (Recharts)
- Properties table with occupancy progress bar
- Recent payments list

---

## Properties

### Desktop
- Search + "Add New Property" button: flex row
- Property cards: 3-column grid (lg:grid-cols-3)
- Card hover: shows Edit/Upload/Delete buttons (opacity-0 → opacity-100)
- Form: inline slide-in panel (full width, max-w-7xl)

### Mobile
- Search + button: stacked column
- Cards: 1 column
- Card hover actions: always visible on touch

### Behavior to preserve
- Card image with circular paid% overlay
- Vacant badge overlay
- Planned mix tags
- Hover action buttons (Edit, Upload, Delete)

### Legacy styling to replace
- Oversized card image (h-56) — use compact card in new system
- Heavy shadow on hover — use subtle shadow

---

## Property Details

### Desktop
- Header: flex row (back + photo + info + Add Unit button)
- Stats: 4-column grid
- Planned inventory: 3-column grid
- Tabs: horizontal tab bar
- Units grid: 3 columns
- Invoices table: full width

### Mobile
- Header: stacked column
- Stats: 2-column grid
- Units grid: 1 column
- Invoices table: horizontal scroll

---

## Units

### Desktop
- Header: flex row with view toggle + Print + Delete + Add
- Filters: flex wrap row
- Table: full width with 5 columns
- Grid: 3 columns

### Mobile
- Header: stacked
- Filters: wrap
- Table: horizontal scroll
- Grid: 1 column

---

## Tenant Management

### Desktop
- Header: flex row
- Quick nav pills: flex wrap
- Filter bar: sticky, flex wrap
- Table: min-width 1700px with dual horizontal scrollbar

### Mobile
- Table: hidden on mobile (`hidden md:block`)
- ⚠️ No mobile view for tenant table — only desktop table shown
- Recommendation: Add mobile card view in new system

### Behavior to preserve
- Dual scrollbar (top phantom + table)
- Sticky filter bar
- Row click → profile page

---

## Invoice List

### Desktop
- Header: flex row with stats grid + action buttons
- Filters: flex row
- Table: min-width 1700px, horizontal scroll

### Mobile
- Table: horizontal scroll
- Stats: 2×2 grid

---

## Auto-Billing

### Desktop
- Controls: 4-column grid (billing cycle, split rule, split preview, run button)
- Summary tiles: 3-column grid × 2 rows
- Property hub: 3-column grid
- Preview table + STK panel: 2-column grid (1.6fr + 0.9fr)

### Mobile
- Controls: stacked
- Property hub: 1 column
- Preview + STK: stacked

---

## M-Pesa Tracker

### Desktop
- Summary tiles: 6-column grid
- Filters: 5-column grid
- Table: full width

### Mobile
- Summary tiles: 2-column grid
- Filters: stacked
- Table: horizontal scroll

---

## Reconciliation

### Desktop
- Summary tiles: 4-column grid
- Invoice drill-down: 3-column grid (Invoice + Callbacks + Payouts)
- Raw callbacks + Ledger + Payout: 3-column grid

### Mobile
- All sections: stacked

---

## Notes on New System Layout

The new Hakika Business OS uses a compact layout. The following legacy patterns should NOT be copied:

| Legacy pattern | Recommendation |
|----------------|----------------|
| h-56 property card images | Use compact 120px image or icon |
| Oversized rounded-3xl cards | Use standard rounded-xl |
| `text-3xl font-black` everywhere | Use standard typography scale |
| `px-8 py-5` table cells | Use compact `px-4 py-3` |
| `max-w-7xl` with heavy padding | Keep max-width, reduce padding on mobile |

The following behaviors MUST be preserved:

| Behavior | Reason |
|----------|--------|
| Dual scrollbar on tenant table | UX for wide tables |
| Sticky filter bar | Usability |
| Realtime invoice updates | Core billing feature |
| STK push modal with live status | Core payment feature |
| 4-step swap unit dialog | Complex workflow |
| Lightbox for property photos | Photo management |
| Inline rent edit in lease modal | Quick edit UX |

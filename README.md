# FinVault — Personal Finance & Expense Tracker Dashboard

> A premium, fully-interactive single-page finance dashboard built with pure Vanilla HTML5, CSS3, and JavaScript. No frameworks. No dependencies. Just clean, production-grade code.

---

## 🖥️ Live Demo

> **[→ Open index.html in your browser to launch the app]**
>
> *(Host on any static server, GitHub Pages, Netlify, or Vercel — simply drop the three files and open.)*

---

## ✨ Features

### 📊 Dashboard & Metrics
- **4 real-time metric cards** — Total Balance, Total Income, Total Expenses, and Savings Rate
- **Animated counter transitions** — numbers smoothly count up/down with cubic-ease animation when values change
- **Savings Rate progress bar** — visual percentage bar that updates instantly
- **Balance trend indicator** — shows positive/negative/break-even state with color feedback

### ➕ Add Transaction Modal
- **Clean modal/overlay** with backdrop blur and spring-entry animation
- **Income / Expense type toggle** — one-click switch with color-coded active states
- **Full form validation** — real-time inline error messages, required field checks, min/max amount validation
- **Category selector** — 16 pre-configured categories split into Income and Expense optgroups
- **Optional note field** — attach a short memo to any transaction
- **Date picker** — defaults to today, fully editable
- **Keyboard shortcut** — `Ctrl+N` / `Cmd+N` to open the modal from anywhere

### 📋 Transaction History Table
- **Dynamic append** — new transactions appear at the top instantly
- **Sortable columns** — click any column header to sort ascending/descending (title, category, date, amount)
- **Search box** — filter transactions by title, category, or note in real-time
- **Type filter** — show All / Income / Expense only
- **Category filter** — automatically populated from existing transactions
- **Delete with confirmation** — safe two-step delete modal prevents accidents
- **Clear All** — bulk-delete all transactions with one click (also guarded by confirmation modal)
- **Animated row entries** — staggered slide-in animation when rows are added

### 📈 Visual Analytics
- **Bar chart** — displays income vs. expense per category (top 7), with hover tooltips showing exact amounts
- **Category breakdown list** — shows all categories ranked by total with color-coded progress bars and amounts

### 💾 Persistence
- **localStorage** — all transactions persist across browser sessions automatically
- **No backend required** — 100% client-side, works offline

### 🎨 Design & UX
- **Premium dark mode** — deep charcoal (`#0F172A`, `#1E293B`) base with neon green (`#10B981`) accents
- **Glassmorphism-adjacent** modal with backdrop blur
- **Toast notifications** — slide-in success/info/error toasts for every action
- **Custom scrollbars**, smooth scrolling, and coherent focus-visible states for accessibility
- **Mobile sidebar drawer** — hamburger menu transforms sidebar into a slide-in overlay on small screens
- **ARIA attributes** — all interactive elements are properly labeled for screen readers

---

## 🛠️ Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Markup     | Semantic HTML5 (`<main>`, `<article>`, `<section>`, `<aside>`, ARIA roles) |
| Styling    | Pure CSS3 — Custom Properties, CSS Grid, Flexbox, `@media` queries |
| Fonts      | Google Fonts — DM Sans (body) + DM Mono (numbers) |
| Logic      | Vanilla JavaScript (ES6+) — IIFE, module pattern, no bundler needed |
| Storage    | `localStorage` API                      |
| Icons      | Inline SVG (zero external requests)     |
| Charts     | CSS + JS-generated DOM bars (no chart library) |
| Build tool | **None** — open `index.html` directly   |

---

## 📁 File Structure

```
finance-tracker/
├── index.html       # Single HTML shell — sidebar, metrics, table, modals, toasts
├── style.css        # All styles — design tokens, layout, components, responsive
├── main.js          # All logic — state, rendering, filters, modals, charts
└── README.md        # This file
```

---

## 🏗️ JavaScript Architecture

The entire app lives in one **IIFE** (`FinVaultApp`) to avoid polluting global scope. Inside, six purpose-built modules communicate through clean function calls:

```
FinVaultApp (IIFE)
├── Utils          — Pure helpers: format currency/date, generate IDs, animate values
├── StateManager   — Single source of truth; all read/write goes through here; handles localStorage
├── ToastManager   — Lightweight notification queue (success / info / error)
├── ChartRenderer  — Renders the bar chart and category breakdown list from state
├── UIRenderer     — Updates metric cards, date badge, and transaction table DOM
├── FilterManager  — Applies search/type/category filters and column sorting on top of state
├── ModalManager   — Controls add-transaction modal, form validation, confirm-delete modal
├── SidebarManager — Mobile hamburger / overlay / nav-link click handling
└── App            — Bootstraps everything, wires all event listeners, exposes refreshAll()
```

**Data flow:**
1. User action → `ModalManager` validates → `StateManager.addTransaction()`
2. `App.refreshAll()` called → `UIRenderer.updateMetrics()` + `ChartRenderer.*()` + `FilterManager.refresh()`
3. `FilterManager` reads from `StateManager`, applies filters/sort → calls `UIRenderer.renderTransactions()`
4. All state changes are automatically persisted to `localStorage`

---

## 🚀 Getting Started

### Option 1 — Direct open
```bash
# Just double-click index.html, or:
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

### Option 2 — Local dev server (recommended for font loading)
```bash
# Python 3
python3 -m http.server 3000

# Node (npx)
npx serve .

# VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```
Then navigate to `http://localhost:3000`.

### Option 3 — Deploy to static hosting
Drop all three files into any static host:
- **GitHub Pages** — push to a repo, enable Pages in settings
- **Netlify** — drag & drop the folder at netlify.com/drop
- **Vercel** — `npx vercel` in the project directory

---

## ⌨️ Keyboard Shortcuts

| Shortcut          | Action                  |
|-------------------|-------------------------|
| `Ctrl+N` / `Cmd+N`| Open Add Transaction modal |
| `Escape`          | Close any open modal    |
| `Enter` / `Space` | Activate sort header (when focused) |
| `Tab`             | Navigate all interactive elements |

---

## 📱 Responsive Breakpoints

| Breakpoint    | Layout                                          |
|---------------|-------------------------------------------------|
| `> 1200px`    | Full 4-column metrics + 2-column content grid   |
| `≤ 1200px`    | 2-column metrics + 1-column content stack       |
| `≤ 768px`     | Mobile: top header bar, sidebar becomes drawer  |
| `≤ 480px`     | Single-column metrics stacked vertically        |

---

## 🎨 Design Tokens Reference

All colors and spacing live in CSS custom properties at `:root` in `style.css`:

```css
--bg-base:     #0F172A   /* deepest background */
--bg-surface:  #1E293B   /* cards & sidebar */
--bg-elevated: #263349   /* inputs & hover states */
--green:       #10B981   /* primary brand / income */
--expense:     #F43F5E   /* expense / danger */
--savings:     #818CF8   /* savings / indigo accent */
--balance:     #38BDF8   /* balance / sky accent */
```

---

## ♿ Accessibility

- All interactive elements have `aria-label` or visible text labels
- Modal dialogs use `role="dialog"`, `aria-modal`, and `aria-labelledby`
- Live regions (`aria-live="polite"`) announce balance changes to screen readers
- Table headers have `aria-sort` attributes that update on sort toggle
- Sortable `<th>` elements are keyboard-focusable (`tabindex="0"`)
- Focus is moved into modals on open and restored on close
- All color contrasts meet WCAG AA minimums

---

## 🧩 Extending the App

Some ideas for extending this foundation:

- **Multi-currency support** — swap `en-US` / `USD` in `Utils.formatCurrency`
- **Budget limits** — add a `budgets` object to state, compare against category totals
- **CSV export** — iterate `StateManager.getTransactions()` and construct a Blob download
- **Monthly view** — add a month/year picker and filter by `tx.date` range
- **Recurring transactions** — add a `recurring` boolean + frequency field
- **Dark/light toggle** — swap CSS variables on `:root` via a class toggle

---

## 📄 License

MIT — free to use, modify, and distribute for personal or commercial projects.

---

*Built with ❤️ using zero dependencies — just HTML, CSS, and JavaScript.*

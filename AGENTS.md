# CompGraph Developer Agent Guide 🤖

This document provides a technical overview of the CompGraph codebase, mathematics, schemas, and styling constraints. Read this document before proposing or implementing changes.

---

## 🏛️ Project Architecture

CompGraph is a serverless, 100% client-side career progression dashboard built with **React 19 + Vite 8 + Vanilla CSS**.
- **No Backend**: All user data remains in browser `localStorage`. No login, authentication, or email addresses are requested.
- **SVG Rendering Engine**: The timeline chart in [CompChart.jsx](src/components/CompChart.jsx) is drawn dynamically using standard SVG paths and components rather than a heavy graphing library, allowing high visual customization.
- **Responsive Layout**: Re-measures width using a `ResizeObserver` bound to a React state to resize the graph coordinates instantly.

---

## 📊 Data Schemas

The application handles two chronological data lists stored in local storage:

### 1. Base Salary Events (`salaryEvents`)
- Stored under key: `comp_graph_salary_events`
- At most **one** salary rate is permitted per calendar month (`YYYY-MM`).
- Schema:
```typescript
interface SalaryEvent {
  id: string;        // Prefixed with "s_"
  date: string;      // Format "YYYY-MM" or "YYYY-MM-DD"
  salary: number;    // Annual base salary rate (positive/negative/decimals)
  type: "hike" | "promotion" | "jobswitch";
  currency?: string; // Optional per-event currency code (USD, INR, GBP, EUR, JPY, CAD, AUD, SGD)
  title: string;     // Description label
  company: string;   // Employer context (e.g., "Google", "Freelance", "Self-Employed")
}
```

### 2. Compensation Events (`compEvents`)
- Stored under key: `comp_graph_comp_events`
- Represents discrete, one-time financial events. Multiple events can land on the same month.
- Schema:
```typescript
interface CompEvent {
  id: string;        // Prefixed with "c_"
  date: string;      // Format "YYYY-MM" or "YYYY-MM-DD"
  amount: number;    // Value in event currency
  type: "bonus" | "grant" | "vest"; // Cash bonus, stock grant, vesting event
  currency?: string; // Optional per-event currency code (USD, INR, GBP, EUR, JPY, CAD, AUD, SGD)
  title: string;     // Description label
  company: string;   // Employer context (e.g., "Google", "Freelance", "Self-Employed")
}
```

---

## 🧮 Mathematical Calculations

### 1. Realized Career Earnings Integration
Base salary is continuous, while comp events are discrete. Realized earnings sum up everything **up to the end of the last completed calendar month** (derived from the current system date):
- **Base Salary Component**: The area under the base salary step-line is integrated chronologically:
  $$\text{Base Earned} = \sum_{i} (\text{Salary}_i \times \text{DurationYears}_i)$$
  Where the duration of segment $i$ is calculated between $\max(\text{baselineDate}, \text{startDate}_i)$ and $\min(\text{cutoffDate}, \text{startDate}_{i+1})$.
- **Realized Compensation**: Sum of all `bonus` and `vest` events dated before the start of the current month. Paper `grant` events represent future potential value and are excluded.

### 2. Concentric Doughnut Rings (Overlapping Events)
If multiple financial events occur in the same month, they are rendered as concentric circles. To prevent visual distortion, the physical area of each ring is made directly proportional to its amount:
- **Base Circle Radius**:
  $$R_{\text{base}} = \sqrt{R_{\text{min}}^2 + (R_{\text{max}}^2 - R_{\text{min}}^2) \times \frac{\text{Amount}}{\text{MaxAmount}}}$$
- **Innermost Circle**: Sorted smallest first, drawn as a filled circle with radius $R_0 = R_{\text{base}}$.
- **Outer Doughnut Ring**:
  $$R_n = \sqrt{R_{n-1}^2 + R_{\text{base}, n}^2}$$
  This maintains linear area scaling across overlapping segments, drawn as a ring of radius $R_{\text{mid}} = \frac{R_n + R_{n-1}}{2}$ and stroke width $W = R_n - R_{n-1}$.

### 3. Currency Conversion (Exchange Rates)
For multi-currency portfolios, all calculations and chart displays are dynamically converted into the target user-selected default currency using static exchange rates relative to USD:
- Static conversion table relative to USD:
  - USD: 1.0, INR: 83.0, GBP: 0.79, EUR: 0.92, JPY: 155.0, CAD: 1.37, AUD: 1.51, SGD: 1.35.
- Conversion formula:
  $$\text{Value}_{\text{target}} = \text{Value}_{\text{source}} \times \frac{\text{Rate}_{\text{target}}}{\text{Rate}_{\text{source}}}$$

---

## 🇮🇳 Special INR Formatting Rules

Shorthand amounts inside graphs and axes are formatted to align with Indian numbering conventions when the selected currency is `INR` (₹):
- **Lakhs Range** (Values $\ge$ ₹1,000 and < ₹1 Crore): Represented in thousands (`k`) using Indian grouping commas.
  - *Example*: `₹18,49,000` is formatted as `₹18,49k`.
- **Crores Range** (Values $\ge$ ₹1 Crore): Represented in Lakhs (`L`) using Indian grouping commas.
  - *Example*: `₹1,52,0,000` (1.52 Cr) is formatted as `₹1,52L`.
- **Implementation Method**: Values are rounded to the nearest thousand (for `k`) or Lakh (for `L`), formatted with `Intl.NumberFormat('en-IN')`, and then sliced to remove trailing digits (slicing off the last 4 characters `",000"` for thousands, or last 7 characters `",00,000"` for Lakhs).

---

## 📐 Layout & Styling Constraints

To prevent layout shifts and keep the visual presentation premium, follow these layout rules defined in [index.css](src/index.css):
- **Desktop Grid Columns**: Controlled via `grid-template-columns: 1fr 380px;` on screen widths $\ge 1024\text{px}$. This keeps the sidebar locked to exactly **380px** width to prevent width changes when switching tabs, while the graph expands to fill remaining space.
- **Widescreen Maximum Width**: The `.app-container` has a maximum width of **1800px** on widescreen monitors.
- **Dynamic SVG Height**: In `CompChart.jsx`, the SVG height scales to `460px` when container width > `1200px` (keeps aspects proportional), and falls back to `420px` otherwise.
- **Text Truncation & Grid Alignment**:
  - Enforce `min-width: 0` on flex items and parent containers to enable proper CSS text truncation.
  - Title strings in sidebar lists must use `whiteSpace: 'nowrap'`, `overflow: 'hidden'`, and `textOverflow: 'ellipsis'`. Add native `title` attributes so full texts are readable on hover.
  - Tooltips on the graph allow text wrapping up to `220px` max-width.

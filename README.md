# CompGraph 📈

CompGraph is a visually stunning, interactive web dashboard designed to track, visualize, and plan your career compensation milestones starting from any month and year. 

Instead of traditional, rigid chart templates, CompGraph uses a **custom high-fidelity React SVG engine** to map base salary steps and overlay discrete financial payouts directly onto your career timeline.

---

## 🌟 Key Features

### 1. Step-Line Salary Charting & Segment Labels
* Base salary changes (hikes, promotions, job switches) are mapped chronologically.
* The line remains flat between events and steps vertically at transition points, accurately representing salary adjustments over time.
* Features interactive diamond nodes on transition points that calculate the percentage difference between your new and previous salary rate.
* **Salary Line Denoted Values**: Shorthand base salary values (e.g. `₹120k`) are displayed directly on top of the horizontal step-line segments.
* **Segment-Start Alignment**: Positioned at the beginning of each horizontal line segment (aligned left using `textAnchor="start"`) with clean offsets (`+8px` for the initial segment, and `+14px` for subsequent segments) to prevent overlapping axis lines or transition nodes.

### 2. Proportional Payout Overlays (Circles on the Line)
* Discrete financial events (bonuses, stock grants, vested equity) are rendered as glowing, transparent circles centered **exactly on the salary line** at their payout month.
* **Proportional Scaling**: Circle radius scales non-linearly (Radius $\propto \sqrt{\text{Amount}}$) so that the circle **area** is directly proportional to the cash/equity value.
* Overlapping items blend cleanly with modern CSS backdrop-filters.
* Large circles display short-hand value tags (e.g., `$15k`, `$80k`) for at-a-glance scanning.
* **Concentric Doughnut Rings**: If multiple events (e.g., RSU vesting and a cash bonus) land on the exact same month, the larger event renders as a clean, hollow **doughnut ring** surrounding the smaller event's filled circle. This keeps each event individually hoverable and matches area proportionality mathematically ($R_{outer} = \sqrt{R_{inner}^2 + R_{base}^2}$).

### 3. Secure Accounts, Authentication & Database Persistence
* **Multi-User Registration & Login**: Set up a personalized profile to secure your career timeline.
* **Double Cryptographic Password Hashing**: Plain-text passwords are **never** sent over the network. CompGraph uses native client-side SHA-256 pre-hashing to send a secure `passwordHash` fingerprint to the server, which then hashes this digest a second time using `bcryptjs` (10 rounds) for database storage. This prevents raw passwords from appearing in the browser's Network request payloads.
* **30-Day Session Persistence**: Access is authenticated using signed JSON Web Tokens (JWT) stored locally, persisting your session for exactly 30 days before requiring re-authentication.
* **One-Click Local Storage Migration**: If you worked as a guest in offline mode, you can instantly upload and migrate your local browser timeline entries into your new database account upon signing up.

### 4. Smart Realized Earnings Metrics
* Integrates the area under the step-line from your configured timeline start month up to the end of the **last completed calendar month** (dynamically derived relative to the current date) to compute the exact **Cumulative Base Salary Earned**.
* Aggregates base salary, cash bonuses, and vested stock filtered up to the last completed month to report your **Realized Career Earnings**. Future events/milestones do not prematurely inflate realized earnings.
* Separately tracks paper **Stock Grants** to maintain a clear line between potential and realized compensation.

### 5. Multi-Currency & PPP Mode Support
* Switch formatting locales dynamically (USD, INR, GBP, EUR, JPY, CAD, AUD, SGD).
* Renders shorthand symbols (e.g., `$15k`, `£80k`, `€3k`) and dynamic form input labels based on the active selection.
* **Country Select & Currency Sync**: Align country and currency selections automatically (e.g., choosing `India` defaults input currency to `INR` and vice versa) while allowing manual adjustments.
* **Purchasing Power Parity (PPP) Mode**: Toggle PPP mode to dynamically normalize all compensation metrics, projections, and chart coordinates into `PPP $` (International USD) using private consumption PPP conversion factors.
* **Live Exchange Rates & World Bank Cache**: Fetches live nominal exchange rates (via `open.er-api.com`) and World Bank LCU-per-PPP conversion factors, caching them daily in `localStorage` under a configurable duration threshold.
* **Reference pop-ups**: Access active exchange rates and PPP conversion tables via two separate header control buttons (`💱 Exchange Rates` and `📊 PPP Factors`).
* **Special INR Formatting**: Formats INR values using a corporate-preferred Indian grouping style. Values in the Lakhs range (less than 1 Crore) are formatted in thousands (e.g., `₹18,49k` for 18.49L), and values in the Crores range are formatted in Lakhs (e.g., `₹1,52L` for 1.52Cr).
* **Flexible Precision & Negative Inputs**: Switched number input constraints to `step="any"` and removed `min` bounds. This allows entering precise numbers (like `105,250`) without browser "nearest numbers" errors, and fully supports negative entries (e.g. pay cuts, salary decreases, or clawbacks).

### 6. Monthly Gross & Net Salary Visualizations
* **Monthly Calculations**: Automatically calculates a read-only **Monthly Gross Salary** (`Annual Remuneration / 12`).
* **Optional Take-Home Net Input**: Enter an optional **Monthly Net Salary** representing take-home money after PF and income tax deductions.
* **Take-Home Timeline step-line**: Plots your annualized net salary as a distinct dashed green step-line in the chart. When net salary is not defined, the take-home line merges cleanly with the solid Gross Salary step-line.
* **Independent Filters & Legend**: Show or hide the Net Take-Home line using the filter timeline buttons or identify it via the legend indicator.
* **Hike Nodes Tooltip**: Hovering over salary change nodes displays Monthly Gross, Monthly Net, and computes the absolute **Monthly Net Hike** along with its percentage change relative to the previous period.
* **Metadata list**: Side-by-side Gross and Net salaries are listed in the Manage tab timeline list next to the annual milestones.

### 7. Day & Night Theme Selector
* Switch between a glowing dark-mode interface, a clean light-mode layout, or a **System Default** setting that synchronizes with your device theme.
* Adjusts all CSS design variables, form inputs, tooltips, chart grids, dropdown select menus, and base colors dynamically.
* Automatically stores your theme choice in local storage to preserve settings on reload.

### 8. Interactive Onboarding & Data Importers (CSV, JSON & Guest Data)
* **Onboarding Overlay Panel**: When a user logs in with an empty timeline, resets their data, or creates a new account, a visual setup card presents quick-import options.
* **Pure Client-Side CSV Importer**: Upload a CSV spreadsheet containing your milestones. A custom client-side RFC 4180 parser maps and loads your events dynamically.
* **JSON Backup Export & Import**: Export/Import JSON backups to restore complete timelines, currencies, starting dates, and profile configurations.
* **Direct Database Operations**: Additions, edits, and deletions are saved directly to the database via relational endpoints.
* **High-Resolution PNG Download**: Save the career progression SVG chart directly as a high-quality PNG image preserving active theme settings.

---

## 🛠️ Tech Stack & Architecture

* **Framework**: React 19 + Vite 8 (extremely fast Hot Module Replacement)
* **Styling**: Vanilla CSS (CSS variables, glassmorphism, responsive grid, custom scrollbars)
* **Visualization**: Dynamic SVG viewport rendering coordinates determined by dates and salary ranges.
* **Responsiveness**: SVG bounds are computed dynamically on window resize using a React-bound `ResizeObserver`.
* **State & Persistence**: Synchronized in real-time with `localStorage` so your graph updates are saved automatically.
* **Icons**: `lucide-react`

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18 or higher recommended) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/pushkal02/career-comp-graph.git
   cd career-comp-graph
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file at the root of the project and populate it as documented in `.env.example`:
   ```bash
   # Create a copy of the example environment file
   cp .env.example .env
   ```
   Set your `DATABASE_URL` with your MongoDB connection string (e.g. MongoDB Atlas cluster link), custom `JWT_SECRET`, and backend `PORT`.

4. Apply the Prisma schema to MongoDB:
   ```bash
   npm run db:push
   ```

5. Launch both frontend and backend development servers concurrently:
   ```bash
   npm run dev:all
   ```
   Open `http://localhost:5173` in your browser.

### Creating a Production Bundle
To build the application for deployment:
```bash
npm run build
```
This outputs compiled, minified, and optimized assets to the `dist/` directory.

To preview your production build locally:
```bash
npm run preview
```

### Deploying to Render
CompGraph can be hosted as a single Node.js **Web Service** on Render, which compiles the client bundle and serves both the API and static React frontend assets seamlessly:

1. **Service Type**: Web Service
2. **Build Command**: `npm install && npm run build && npm run db:generate`
3. **Start Command**: `npm run server`
4. **Environment Variables**:
   * `DATABASE_URL`: MongoDB Atlas connection string.
   * `JWT_SECRET`: Random string for JWT signing.
   * `NODE_ENV`: `production`
5. **Health Check Path**: Configured to `/api/health` (returns `{ "status": "UP" }` to ensure zero-downtime rolling deploys).

*(Note: Push updates to GitHub/GitLab will auto-trigger builds. You can exclude `README.md` from trigger builds in your Render environment settings under Ignored Paths.)*

---

## 🧮 Mathematical Calculations

To ensure absolute precision, consistency, and fidelity across different display modes and viewport resolutions, CompGraph operates on the following mathematical frameworks:

### 1. Cumulative Realized Earnings Integration
CompGraph differentiates between continuous income streams (salary remuneration segments) and discrete payouts (compensation events like bonuses or equity vests). Cumulative realized earnings are computed **up to the end of the last completed calendar month** (derived from the active system date):
* **Continuous Salary Integration**:
  $$\text{Base Salary Component} = \sum_{i} \left( \text{Salary}_i \times \text{DurationYears}_i \right)$$
  Where the duration (in years) for segment $i$ is calculated between $\max(\text{timelineStart}, \text{startDate}_i)$ and $\min(\text{currentMonthStart}, \text{startDate}_{i+1})$.
* **Discrete Realized Compensation**: Sum of all `bonus` and `vest` events occurring before the start of the current calendar month. Paper-only `grant` events (representing future/unvested potential value) are excluded from realized earnings metrics.
* **Monthly Net Take-Home Fallback**: If an optional monthly net salary is not supplied for a salary event, it defaults to the monthly gross salary ($\text{salary} / 12$) to ensure continuous line projection.

### 2. Concentric Doughnut Rings (Overlapping Payouts)
When multiple compensation events fall on the same month, rendering them as stacked or overlapping circles creates visual occlusion. CompGraph draws them as concentric circles, where the physical **area** of each segment is directly proportional to its monetary amount:
* **Base Circle Radius**:
  $$R_{\text{base}} = \sqrt{R_{\text{min}}^2 + (R_{\text{max}}^2 - R_{\text{min}}^2) \times \frac{\text{Amount}}{\text{MaxAmount}}}$$
* **Innermost Circle**: Sorted smallest by amount, drawn as a filled circle with radius $R_0 = R_{\text{base}}$.
* **Outer Doughnut Rings**: For each subsequent overlapping event $n$:
  $$R_n = \sqrt{R_{n-1}^2 + R_{\text{base}, n}^2}$$
  This maintains linear area scaling, drawn as a stroke ring with a midpoint radius of $R_{\text{mid}} = \frac{R_n + R_{n-1}}{2}$ and a stroke width of $W = R_n - R_{n-1}$.

### 3. Multi-Currency Conversion
All figures are converted to the target display currency. For nominal rates, CompGraph queries daily nominal USD rates and converts using the standard exchange rate cross-multiplication:
$$\text{Value}_{\text{target}} = \text{Value}_{\text{source}} \times \frac{\text{Rate}_{\text{target}}}{\text{Rate}_{\text{source}}}$$

When **Purchasing Power Parity (PPP) Mode** is active, figures are adjusted using World Bank private consumption PPP conversion factors:
$$\text{Value}_{\text{PPP}} = \frac{\text{Value}_{\text{Local Currency}}}{\text{PPP Factor}}$$

---

## 💾 Storage & Offline Caching

CompGraph is a fully client-side, serverless application. All state is stored locally:

### Local Storage Keys
* `comp_graph_salary_events`: Chronological list of salary remuneration events (`SalaryEvent[]`).
* `comp_graph_comp_events`: Chronological list of discrete compensation events (`CompEvent[]`).
* `comp_graph_profile_name`: The user's greeting name.
* `comp_graph_profile_country`: The user's active country selection.
* `comp_graph_profile_currency`: The user's active display currency.
* `comp_graph_profile_theme`: Active visual theme mode (`dark` or `light`).
* `comp_graph_cached_rates`: Cached nominal exchange rates relative to USD.
* `comp_graph_cached_ppp`: Cached World Bank PPP conversion factors.
* `comp_graph_cache_timestamp`: Unix timestamp indicating when the rates and PPP factors cache was last retrieved from upstream APIs (expires after 24 hours as defined by `VITE_CACHE_DURATION_MS`).

---

## 📊 Data Models

The dashboard organizes your history into two JSON-serializable schemas:

### Salary Event Schema
Represents changes to your core yearly compensation rate:
```typescript
interface SalaryEvent {
  id: string;        // Prefixed with "s_"
  date: string;      // Format "YYYY-MM" or "YYYY-MM-DD"
  salary: number;    // Annual reference rate
  type: "hike" | "promotion" | "jobswitch";
  title: string;     // Contextual tag (e.g. "Merit Cycle Increase")
  company: string;   // Employer context (e.g. "Google", "Freelance")
  currency?: string; // Optional currency code (USD, INR, GBP, EUR, JPY, CAD, AUD, SGD)
  country?: string;  // Optional country code for PPP conversion (US, IN, GB, DE, JP, CA, AU, SG)
  location?: string; // Optional physical location
  monthlyNetSalary?: number; // Optional monthly take-home salary after tax/PF
}
```

### Compensation Event Schema
Represents discrete one-time or recurring payouts/vestings:
```typescript
interface CompEvent {
  id: string;        // Prefixed with "c_"
  date: string;      // Format "YYYY-MM" or "YYYY-MM-DD"
  amount: number;    // Value in currency
  type: "bonus" | "grant" | "vest";
  title: string;     // Contextual tag (e.g. "Sign-on Bonus", "RSU Vest")
  company: string;   // Employer context
  currency?: string; // Optional currency code
  country?: string;  // Optional country code
  location?: string; // Optional physical location
}
```



Created by Pushkal Pandey with ❤️


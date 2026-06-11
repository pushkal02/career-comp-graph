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

### 3. Personalization & Profile Modal
* **Onboarding Prompt**: Implemented a glassmorphic startup overlay modal prompting for your Full Name if it is not stored in browser cache. Explicitly states and guarantees that all input data is stored 100% client-side in your local browser and never sent to a backend. **No email address or personal credentials are ever requested**.
* **Personalized Header**: Greets the user dynamically (e.g., *"Pushkal Pandey's CompGraph"*) in the title bar.
* **Profile Editing**: Quick-link to edit your profile name at any time, instantly updating dashboard labels and storage values.

### 4. Smart Realized Earnings Metrics
* Integrates the area under the step-line from your configured timeline start month up to the end of the **last completed calendar month** (dynamically derived relative to the current date) to compute the exact **Cumulative Base Salary Earned**.
* Aggregates base salary, cash bonuses, and vested stock filtered up to the last completed month to report your **Realized Career Earnings**. Future events/milestones do not prematurely inflate realized earnings.
* Separately tracks paper **Stock Grants** to maintain a clear line between potential and realized compensation.

### 5. Multi-Currency Support & Input Flexibility
* Switch formatting locales dynamically (USD, INR, GBP, EUR, JPY, CAD, AUD, SGD).
* Renders shorthand symbols (e.g., `$15k`, `£80k`, `€3k`) and dynamic form input labels based on the active selection.
* **Special INR Formatting**: Formats INR values using a corporate-preferred Indian grouping style. Values in the Lakhs range (less than 1 Crore) are formatted in thousands (e.g., `₹18,49k` for 18.49L), and values in the Crores range are formatted in Lakhs (e.g., `₹1,52L` for 1.52Cr).
* **Flexible Precision & Negative Inputs**: Switched number input constraints to `step="any"` and removed `min` bounds. This allows entering precise numbers (like `105,250`) without browser "nearest numbers" errors, and fully supports negative entries (e.g. pay cuts, salary decreases, or clawbacks).

### 6. Day & Night Theme Selector
* Switch between a glowing dark-mode interface and a clean, high-contrast light-mode layout.
* Adjusts all CSS design variables, form inputs, tooltips, chart grids, dropdown select menus, and base colors dynamically.
* Automatically stores your theme choice in local storage to preserve settings on reload.

### 7. Graph Export & Data Backups
* **High-Resolution PNG Download**: Render and save the career progression SVG chart directly as a high-quality PNG image to share or insert into documents. The active theme styling is automatically preserved in the export.
* **Persistent Local Storage**: Timeline data is saved in your browser's persistent local storage with no expiration date.
* **Backup Export & Import**: Displays helpful recommendation notifications advising users to periodically **Export JSON** to keep offline backups. Click **Import JSON** to load a backup file (via the HTML5 `FileReader` API), validate the content, and restore your complete timeline and profile settings instantly.
* **Clean Sandbox State**: Launches into a completely clean, empty sandbox graph state with no preset baseline salary. All entries can be edited, deleted, or cleared.

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

3. Launch the local development server:
   ```bash
   npm run dev
   ```
   Open the printed URL (usually `http://localhost:5173`) in your browser.

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

---

## 📊 Data Models

The dashboard organizes your history into two JSON-serializable schemas:

### Salary Event Schema
Represents changes to your core yearly compensation rate:
```typescript
interface SalaryEvent {
  id: string;
  date: string;    // Format: "YYYY-MM" (e.g. "2024-03")
  salary: number;  // Annual reference rate in USD
  type: "hike" | "promotion" | "jobswitch";
  title: string;   // Contextual tag (e.g. "Merit Cycle Increase")
}
```

### Compensation Event Schema
Represents discrete one-time or recurring payouts/vestings:
```typescript
interface CompEvent {
  id: string;
  date: string;    // Format: "YYYY-MM" (e.g. "2024-06")
  amount: number;  // Value in USD
  type: "bonus" | "grant" | "vest";
  title: string;   // Contextual tag (e.g. "Sign-on Bonus", "RSU Vest")
}
```

---

Created by Pushkal Pandey with love ❤️


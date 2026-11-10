# Collapsible Deliverable Sub-Categories & Google Sheet Export

Add collapsible sub-category topic breakdowns (e.g. individual video titles, post topics, brochure titles, and optional notes) under each deliverable in Works Completed, preserving manual aggregate counts, syncing in real-time via Cloud Firestore, and providing automatic Google Sheet export to a new dedicated tab.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during interactive clarification and govern the implementation:

- **Independent Manual Count**: The main deliverable count remains manual as entered by the user, while sub-items are listed independently beneath it as detailed itemized topics.
- **Sub-Item Details**: Each sub-item records a **Topic Title** and an **Optional Short Note**.
- **Data Persistence & Sheet Export**: Changes persist immediately across all devices and incognito viewers via Cloud Firestore (`config/active_dashboard`), and an automated **"Export Breakdown to Sheet Tab"** creates and populates a new tab in the connected Google Sheet workbook with all deliverables and their itemized topics.

---

## 1. Overview & Core Concept

### What It Does
In the **Works completed** list (Chart view and Table view), every deliverable row (e.g., "Reels Video", "Social posts", "GMB posts") gains a clean, prominent collapsible toggle button. When expanded, users can:
1. View all recorded topics/sub-items for that deliverable in the selected month.
2. Add new topics one by one (Topic Title + optional short note).
3. Edit or delete existing topics inline.
4. Auto-save all breakdown details directly to Firestore in real time, and export a clean, organized "Monthly Topic Breakdown" tab into Google Sheets / Excel.

### Key Value
Gives stakeholders full transparency into *what* specific content pieces comprise each number (e.g. which 3 reels were produced in October or November) without cluttering the high-level monthly dashboard summary.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────────────────────────────────────────────────────┐
│ Works completed                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ 🎬 Reels Video                   17.1%  [ 6 items ]  [v 3 topics]      │
│    Educational & promotional reels batch                               │
│                                                                        │
│    ▼ Sub-Categories / Topics Breakdown (Expanded)                      │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │ • Fleet Fuel Sensor Installation Guide                      │    │
│    │   Note: Highlighted live sensor telemetry in demo truck      │    │
│    │ ──────────────────────────────────────────────────────────── │    │
│    │ • Driver Safety AI Camera Alert Showcase                     │    │
│    │   Note: 30s quick cut for LinkedIn and Instagram reels       │    │
│    │ ──────────────────────────────────────────────────────────── │    │
│    │ • Cold Chain Temperature Monitoring Walkthrough              │    │
│    │   Note: Customer case study with refrigerated logistics      │    │
│    │ ──────────────────────────────────────────────────────────── │    │
│    │ [+ Add topic] (Title + optional note form)                   │    │
│    └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Collapsible Header Indicator**:
   - Each deliverable row in `BrandWorksCompleted` displays a subtle, interactive pill/badge indicating the sub-item count (e.g., `3 topics` or `+ Add topic`).
   - Clicking the toggle expands/collapses the sub-category container smoothly with Chevron animations.
2. **Inline Add / Edit Experience**:
   - An intuitive inline form with inputs for `Topic Title` and `Note (optional)` with `Add` and `Cancel` controls.
   - Edit and delete actions available for editors, while remaining strictly read-only for view-only visitors and incognito links.
3. **Month-Scoped Breakdown**:
   - Just like deliverable notes, sub-items are tied to the selected month so October video topics only appear in October, and November topics only appear in November.
4. **Google Sheet Sync & Export**:
   - A dedicated **"Export Sub-Items to Sheet / CSV"** action formats all deliverables, their counts, and their nested sub-item topics into a structured sheet layout suitable for paste or direct download as a new sheet page.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Sub-Item Data Schema & Monthly Scoping
- **Chosen Approach**: Store sub-items within `monthlySubItems: Record<string, SubItem[]>` on each `WorkItem`, with fallback to `subItems?: SubItem[]`.
- **Why**: Guarantees strict monthly isolation so adding topics in November never pollutes September or October data.
- **Alternatives Considered**: Global sub-items list across all months (rejected because deliverable topics change every month).

### Decision 2: Manual Count Independence
- **Chosen Approach**: The top-level number (e.g. 6 items) is maintained manually, while the sub-category list acts as the specific topic log.
- **Why**: Matches user's explicit preference; avoids accidental count recalculation when team members only log partial topics.

---

## 4. Technical Architecture & Data Strategy

### Component & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                                App.tsx                                 │
│  State: data (DashboardData), isViewOnly, selectedMonth                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         BrandWorksCompleted                            │
│  • Expand/collapse state per deliverable (Set<string>)                 │
│  • Render deliverable row + count + month-specific note                │
│  • Sub-item accordion section with Add/Edit/Delete actions             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│     Cloud Firestore Sync      │   │    Google Sheet Export / Sync     │
│  `config/active_dashboard`    │   │  Generates `Topics Breakdown` tab │
│  Real-time cross-device sync  │   │  Formatted with activities & rows │
└───────────────────────────────┘   └───────────────────────────────────┘
```

### Data Model Extension (`src/types.ts`)

```typescript
export interface DeliverableSubItem {
  id: string;
  title: string;
  note?: string;
  createdAt?: string;
}

export interface WorkItem {
  id: string;
  activity: string;
  count: number;
  category: string;
  notes?: string;
  customNote?: string;
  monthlyNotes?: Record<string, string>;
  monthlyBreakdown?: Record<string, number>;
  // New sub-items structure:
  subItems?: DeliverableSubItem[];
  monthlySubItems?: Record<string, DeliverableSubItem[]>;
}
```

### Verification Plan
1. Test expanding and collapsing sub-categories for deliverables in Works Completed.
2. Add, edit, and delete sub-items with title and optional note in the active month.
3. Switch months (Sep, Oct, Nov) and confirm sub-items are strictly isolated to their respective month.
4. Verify View-Only Mode hides the "+ Add topic" and edit/delete buttons for visitors and incognito links.
5. Verify automatic sync to Firestore and export to the new Google Sheet tab.
6. Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.

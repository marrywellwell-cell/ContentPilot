# Design Guidelines: AI Content Automation Platform

## Design Approach

**Selected Approach:** Design System with SaaS Dashboard Patterns

**Key References:** Linear (clean data-density), Notion (content organization), Asana (project management), modern productivity tools

**Design Principles:**
- Efficiency-first: Minimize clicks, maximize visibility
- Content-centric: Generated content is the hero
- Workflow clarity: Clear progression through creation → scheduling → publishing
- Data transparency: Analytics and status always visible

---

## Core Design Elements

### A. Typography

**Font Family:** Inter or DM Sans via Google Fonts CDN

**Hierarchy:**
- Page Titles: 2xl/3xl, font-semibold
- Section Headers: xl, font-semibold
- Card Titles: lg, font-medium
- Body Text: base, font-normal
- Labels/Meta: sm, font-medium
- Caption/Helper: xs, font-normal

### B. Layout System

**Spacing Units:** Tailwind units of 2, 3, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section gaps: gap-4, gap-6, gap-8
- Page margins: px-6, py-8

**Grid System:**
- Dashboard: 12-column grid with sidebar
- Content cards: 2-3 column responsive grid
- Forms: Single column, max-w-2xl

### C. Component Library

#### Navigation
- **Sidebar Navigation (fixed left, w-64)**
  - Logo/brand at top (h-16)
  - Primary nav items with icons
  - User profile at bottom
  - Active state: subtle background fill

#### Content Generation Interface
- **Keyword Input Section**
  - Large centered input field
  - Platform selector toggles (Instagram/Blog/Both)
  - "Generate Content" CTA button
  
- **Content Preview Cards** (key component)
  - Instagram preview: Phone mockup frame (aspect-[9/16])
  - Blog preview: Article layout preview
  - Edit/Regenerate action buttons
  - Image placeholder with regenerate option
  - Caption/text content with expand/collapse
  - Hashtag chips (pill-shaped, grouped)

#### Calendar Component
- **Monthly Calendar Grid**
  - 7-column grid for days
  - Day cells with scheduled content indicators
  - Drag-drop visual feedback
  - Today highlight
  - Multi-content day: stacked mini previews

- **Content Set Cards** (in calendar)
  - Thumbnail image
  - Platform icons (Instagram/Blog badges)
  - Scheduled time
  - Status indicator (draft/scheduled/published)

#### Forms & Inputs
- **Standard Text Inputs**
  - Border-based, focus ring
  - Label above, helper text below
  - Error states with message
  
- **Date/Time Picker**
  - Calendar dropdown
  - Time selector with AM/PM
  - Quick presets (Tomorrow 9AM, etc.)

- **Platform Connection Cards**
  - Service logo
  - Connection status badge
  - Connect/Disconnect button
  - Last sync timestamp

#### Analytics Dashboard
- **Metric Cards**
  - Large number display
  - Trend indicator (↑ percentage)
  - Comparison label ("vs last week")
  - Icon representing metric

- **Performance Charts**
  - Line charts for trends
  - Bar charts for comparisons
  - Minimal gridlines
  - Data point tooltips

- **Top Content List**
  - Ranked content items (1, 2, 3)
  - Thumbnail + title
  - Key metrics inline
  - View details link

#### Data Display
- **Content Sets Table**
  - Sortable columns
  - Row actions (Edit, Delete, Duplicate)
  - Status badges
  - Platform icons
  - Compact row height

- **Status Badges**
  - Pill-shaped
  - Draft: neutral gray
  - Scheduled: blue
  - Publishing: yellow
  - Published: green
  - Failed: red

#### Overlays
- **Modal Dialogs**
  - Max-w-2xl centered
  - Close button top-right
  - Action buttons bottom-right
  - Content generation wizard: multi-step with progress indicator

- **Toast Notifications**
  - Fixed top-right
  - Auto-dismiss after 5s
  - Success/Error/Info variants
  - Action button (optional)

### D. Animations

**Minimal, Purposeful Interactions:**
- Card hover: subtle lift (translate-y-1)
- Button hover: slight opacity change
- Loading states: simple spinner or skeleton screens
- Drag-drop: smooth transition on release
- Modal: fade + scale entrance
- NO page transitions, parallax, or decorative animations

---

## Page-Specific Layouts

### Dashboard Home
- **Layout:** Sidebar + main content area
- **Sections:**
  1. Quick stats row (4 metric cards)
  2. Recent activity feed (left 2/3) + Quick actions sidebar (right 1/3)
  3. Upcoming scheduled content (horizontal scrollable cards)

### Content Generation Page
- **Layout:** Centered workflow, max-w-4xl
- **Flow:**
  1. Keyword input (large, prominent)
  2. Loading state with progress
  3. Generated content preview (Instagram + Blog side-by-side on desktop, stacked mobile)
  4. Edit controls below each preview
  5. Schedule button (fixed bottom bar)

### Calendar Page
- **Layout:** Full-width calendar grid
- **Header:** Month navigation, view toggle (month/week), filter by platform
- **Grid:** 7 columns, 5-6 rows
- **Side Panel:** Selected day's content details (slides out from right)

### Analytics Page
- **Layout:** Dashboard grid
- **Sections:**
  1. Date range selector + export button
  2. Overview metrics (4-card row)
  3. Performance charts (2-column grid)
  4. Top performing content (table)
  5. Platform breakdown (tabs: Instagram / Blog)

### Settings Page
- **Layout:** Two-column (nav + content)
- **Left:** Settings category nav
- **Right:** Form sections
  - Platform Connections (card list)
  - Brand Settings (tone, style inputs)
  - Notification Preferences (toggle list)

---

## Images

**Hero/Feature Images:** No traditional hero images - this is a dashboard app

**Content Placeholder Images:**
- Instagram preview mockups: Use 9:16 placeholder with abstract patterns or sample content visuals
- Blog preview thumbnails: 16:9 placeholders with gradient backgrounds
- Generated content: Display actual AI-generated images when available

**Empty States:**
- Calendar with no events: Simple illustration of calendar icon + helpful text
- No content yet: Gentle illustration encouraging first content creation
- Failed uploads: Warning icon with clear error message

---

## Key UX Patterns

**Content Creation Workflow:**
1. Single prominent input → 2. Loading with feedback → 3. Preview with edit options → 4. Schedule with calendar → 5. Confirmation

**Multi-Platform Handling:**
- Toggle switches or checkboxes to select Instagram/Blog/Both
- Visual distinction in previews (phone frame vs article layout)
- Platform badges throughout interface

**Error Recovery:**
- Retry buttons on failed uploads
- Draft auto-save indicators
- Clear error messages with actionable steps

**Efficiency Features:**
- Keyboard shortcuts displayed on hover
- Quick actions dropdown on content cards
- Bulk operations selection mode for calendar
- Duplicate content functionality
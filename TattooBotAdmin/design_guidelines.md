# Design Guidelines: Telegram Bot Booking System & Web Admin Panel

## Design Approach: Design System-Based

**Selected System**: Material Design 3 with modern admin dashboard patterns
**Justification**: This utility-focused booking system requires clarity, efficiency, and data-dense interfaces. Material Design provides excellent component patterns for forms, tables, and administrative interfaces while maintaining visual polish.

**Key Design Principles**:
- Clarity over decoration: Every element serves a functional purpose
- Efficient workflows: Minimize clicks for common admin tasks
- Scannable information: Clear visual hierarchy for schedules and bookings
- Responsive data displays: Tables and calendars adapt gracefully

## Core Design Elements

### A. Color Palette

**Light Mode**:
- Primary: 220 90% 56% (Professional blue - trust and reliability)
- Primary Hover: 220 90% 48%
- Secondary: 280 60% 60% (Accent purple for highlights)
- Success: 142 71% 45% (Booking confirmations)
- Warning: 38 92% 50% (Pending actions)
- Error: 0 84% 60% (Conflicts, errors)
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Text Primary: 220 13% 18%
- Text Secondary: 220 9% 46%
- Border: 220 13% 91%

**Dark Mode**:
- Primary: 220 90% 64%
- Primary Hover: 220 90% 72%
- Secondary: 280 60% 68%
- Success: 142 71% 55%
- Warning: 38 92% 60%
- Error: 0 84% 68%
- Background: 220 13% 10%
- Surface: 220 13% 14%
- Text Primary: 0 0% 98%
- Text Secondary: 220 9% 70%
- Border: 220 13% 23%

### B. Typography

**Font Stack**: Inter (Google Fonts) for UI, Roboto Mono for time/dates
- Headings: Inter, 600-700 weight
- Body: Inter, 400 weight
- Labels: Inter, 500 weight
- Data/Times: Roboto Mono, 400 weight

**Scale**:
- H1 (Page Titles): text-3xl (30px)
- H2 (Section Headers): text-2xl (24px)
- H3 (Card Headers): text-xl (20px)
- Body: text-base (16px)
- Small/Meta: text-sm (14px)
- Captions: text-xs (12px)

### C. Layout System

**Spacing Primitives**: Use Tailwind units 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Page margins: px-6 md:px-8 lg:px-12
- Card spacing: p-6
- Form field gaps: space-y-4

**Grid System**:
- Admin dashboard: 12-column grid (grid-cols-12)
- Sidebar: Fixed 280px width (lg:w-[280px])
- Main content: Remaining space with max-width constraints
- Cards grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### D. Component Library

**Navigation**:
- Vertical sidebar (admin panel): Fixed left, collapsible on mobile
- Items: Icon + label, hover background, active state with primary color accent
- Mobile: Bottom sheet drawer

**Data Display**:
- Tables: Striped rows, sticky headers, sortable columns, hover states
- Calendar: Week/month view with color-coded bookings
- Status badges: Rounded-full, small size, with dot indicators
- Master cards: Image thumbnail, name, specialization, availability indicator

**Forms**:
- Input fields: Outlined style with floating labels
- Selects: Dropdown with search for masters/services
- Date/Time pickers: Calendar popup with time slots grid
- File upload: Drag-and-drop zone for Excel files

**Action Elements**:
- Primary button: Solid primary color, medium size, rounded-lg
- Secondary button: Outline style with border
- Icon buttons: Ghost style for table actions
- Floating action button: Bottom-right for quick booking (mobile)

**Cards & Containers**:
- Surface elevation: Subtle shadow (shadow-sm)
- Borders: 1px solid border color
- Rounded corners: rounded-lg (8px)
- Hover states: Slight elevation increase

**Feedback**:
- Toast notifications: Top-right, auto-dismiss
- Loading states: Skeleton screens for data tables
- Empty states: Icon + message + action button
- Confirmation modals: Centered overlay with backdrop blur

### E. Admin Panel Specific Layouts

**Dashboard Overview**:
- Stats cards grid: 4 columns (bookings today, this week, revenue, active masters)
- Recent bookings table: 8-10 rows, expandable details
- Calendar widget: Current week view with quick navigation

**Bookings Management**:
- Filter bar: Date range, master, service, status
- Table view: Client name, master, service, date/time, status, actions
- Detail sidebar: Slides from right with full booking info

**Content Editor**:
- Split view: Preview on right, editor on left
- Bot messages: Organized by section (welcome, booking flow, confirmations)
- Inline editing: Click to edit text directly

**Excel Import/Export**:
- Upload area: Prominent drag-drop zone
- Preview table: Shows parsed data before import
- Export form: Date range selector, format options

### F. Bot Interface Design Philosophy

**Conversational Flow**:
- Clear step indicators showing booking progress
- Inline keyboards with emojis for visual clarity
- Confirmation messages with all booking details
- Error messages with helpful next steps

**Visual Elements**:
- Portfolio images: Aspect ratio 4:3, carousel navigation
- Location map: Embedded static image with "Open in Maps" button
- Payment methods: Icon grid with labels
- Captcha: Simple math question or button sequence

## Images

**Admin Panel**:
- No hero image required - functional dashboard
- Master profile photos: Circular thumbnails, 80×80px
- Portfolio images: Square thumbnails in grid, 200×200px, expand to lightbox
- Empty state illustrations: Simple line art for empty tables/lists

**Bot Integration**:
- Welcome image: Tattoo studio interior or logo (16:9 ratio)
- Portfolio showcase: High-quality tattoo work photos (4:3 ratio)
- Location: Static map screenshot or pin graphic
# The Cut. — Visual Regression Checklist

Manual visual regression test plan. Run after every deploy that touches CSS or render logic.

## How to run

Open the deployed URL in Safari (iOS simulator or device) and Chrome (desktop).
Check each surface below. A pass = no obvious layout breaks, no text overflow, colors correct.

---

## Surfaces

### Auth / Welcome screen
- [ ] Bee logo centered, readable on black
- [ ] "The Cut." wordmark correct
- [ ] Google sign-in button visible and tappable
- [ ] No horizontal scroll

### Home tab
- [ ] Status strip shows correct headline (under/over/on target)
- [ ] Macro donut renders with correct colors (protein=blue, carbs=lime, fat=purple)
- [ ] Today's log grouped by category with correct cat-dot colors
- [ ] Recents pills scroll horizontally without clipping
- [ ] FAB (+ button) visible above bottom nav, not obscured by safe area
- [ ] Pull-to-refresh indicator appears at top on pull

### Log tab — Search mode
- [ ] Search field focused on tab switch
- [ ] Results list renders within card
- [ ] Long-press on log item reveals red Delete button
- [ ] Duplicate (copy) icon visible on each row

### Log tab — Label mode
- [ ] "Take photo" and "From library" buttons side by side
- [ ] "Scan barcode" button full-width below
- [ ] Scanner overlay: black background, lime scan line animates, Cancel button
- [ ] After scan: product card shows name + macros + "Add to log"

### Log tab — Quick mode (AI)
- [ ] Mic button visible, toggles listening state
- [ ] Listening state shows mic icon in hint text

### Log tab — Manual mode
- [ ] All four macro fields (cal/protein/carbs/fat) visible
- [ ] Servings stepper increments correctly

### Meals tab
- [ ] Saved meals list with search + sort controls
- [ ] "Select" button enters multi-select mode
- [ ] Selected meals highlight with lime border
- [ ] "Log N meals" button appears at top when items selected
- [ ] Condiments section scrolls without overlap

### The Kitchen tab
- [ ] Three sub-tabs: Generate / Plan / Import
- [ ] Import: hint text updated to reflect URL fetching
- [ ] Results cards render with "Log" and "Save as meal" actions

### Progress tab
- [ ] Weight chart renders SVG path (no broken graph)
- [ ] ETA to goal shows correct days/lb per week
- [ ] Weekly review card appears on Sunday or when manually triggered
- [ ] Body measurements card collapsible with history list

### Settings tab
- [ ] All sections visible: Profile, Targets, Appearance, Meal Time Windows, Visible Tabs, Export, Import, Meal Reminders, Apple Watch Widget
- [ ] Accent color swatches update --lime variable immediately on tap
- [ ] Visible Tabs toggles remove/restore tabs from nav in real-time
- [ ] Meal time windows save and persist

### PWA / App icon
- [ ] Home screen icon: pure black background, bee fills ~80% canvas
- [ ] Splash screen matches icon (no white flash)
- [ ] Offline: app loads from cache when airplane mode enabled

---

## Devices to test

| Device | Browser | Priority |
|--------|---------|----------|
| iPhone 14 Pro | Safari (PWA) | P0 |
| iPhone SE (small) | Safari | P1 |
| iPhone 14 Plus (large) | Safari | P1 |
| iPad | Safari | P2 |
| Desktop Chrome | Chrome | P1 |
| Desktop Safari | Safari | P2 |

---

## Known baseline

Last verified: 2026-04-21 (post Tier 5 deploy)

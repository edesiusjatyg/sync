## Priority 1: Navigation — `components/app/app-chrome.tsx`

**375px issues:**
- [ ] All nav items overflow horizontally.
- [ ] Avatar + name + email + sign out button cannot fit in one row.
- [ ] Clicking nav items may be inaccessible.

**768px issues:**
- [ ] Same horizontal overflow issues for long names or many links.

**Fix approach:**
- Import `MenuIcon` from `lucide-react` and `Sheet` components from `components/ui/sheet`.
- Use a `hidden lg:flex` wrapper for the desktop nav layout.
- Use a `lg:hidden` wrapper with a `Sheet` for the mobile/tablet hamburger menu.
- Inside the sheet content, vertically stack the links, divider, avatar + user info, and logout button.

## Priority 2: Login / Register Page — `app/(auth)/layout.tsx` & `components/app/auth-form.tsx`

**375px issues:**
- [ ] Two-column layout forces extreme compression due to grid.
- [ ] Hero text ("BUILD STUDY GROUPS WITH COMPLEMENTARY STRENGTHS") at `text-6xl` is too large.

**768px issues:**
- [ ] Same two-column constraint makes form card cramped.

**Fix approach:**
- In `app/(auth)/layout.tsx`, change `lg:grid-cols-[1.05fr_0.95fr]` and ensure the left section displays on mobile. Update hero text from `text-6xl` to `text-3xl md:text-5xl lg:text-6xl`.
- Hide feature cards on mobile (`hidden md:grid`).
- Make layout single column stacked on mobile, single column centered max-width on tablet (`md:max-w-2xl mx-auto`), and restore two-column on `lg:`.
- Update `components/app/auth-form.tsx` typography scaling if needed.

## Priority 3: Task Board — `components/app/task-board.tsx`

**375px issues:**
- [ ] Three-column kanban (TODO, IN PROGRESS, DONE) forces horizontal scroll.
- [ ] Task cards and create forms are too wide.

**768px issues:**
- [ ] (No issue, they fit side-by-side at 768px).

**Fix approach:**
- Import `Tabs` component from `components/ui/tabs`.
- For mobile (`md:hidden`), render the `groupedTasks` inside a `Tabs` structure with "TODO", "IN PROGRESS", "DONE" triggers. 
- For tablet/desktop (`hidden md:grid xl:grid-cols-3`), keep the current three-column grid layout.

## Priority 4: Onboarding Step 1: Skill Picker — `components/app/onboarding-wizard.tsx`

**375px issues:**
- [ ] Two-column grid is too narrow.
- [ ] Checkbox + skill name + category label don't have enough horizontal space.

**Fix approach:**
- Ensure grid is `grid-cols-1 md:grid-cols-2`.
- Make sure skill labels stack correctly or use wrapping `flex-col` for small screens.

## Priority 5: Group Overview Stats Row — `components/app/group-overview.tsx`

**375px issues:**
- [ ] Three stat boxes side by side might be too narrow.

**Fix approach:**
- Adjust grid classes: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- Stack vertically on mobile.

## Priority 6: Discover Card — `components/app/user-card.tsx` & `components/app/discover-board.tsx`

**375px issues:**
- [ ] Avatar + name and score box layout tight.
- [ ] Skill badges overflow.
- [ ] PASS/LIKE buttons need fixed positioning at bottom of viewport.

**Fix approach:**
- Adjust `user-card.tsx`: use `flex-col sm:flex-row` for top header or `items-start justify-between`. Add `flex-wrap` to badges.
- Adjust `discover-board.tsx`: make buttons `fixed bottom-0 inset-x-0 bg-background pb-[env(safe-area-inset-bottom)] p-4 flex justify-between gap-4 z-50` for mobile, and restore inline layout for tablet/desktop. 
- Ensure card container allows scrolling but leaves space for buttons.

## Priority 7: Group Member List — `components/app/group-overview.tsx`

**375px issues:**
- [ ] Skill badges overflow horizontally.
- [ ] Long emails don't wrap/truncate.

**Fix approach:**
- Add `truncate` to email elements.
- Change flex direction to stack on mobile (`flex-col lg:flex-row`), adding `flex-wrap gap-1` for skill badges.

## Priority 8: Onboarding Steps 2–4 — `components/app/onboarding-wizard.tsx`

**375px issues:**
- [ ] Step 2 (Time blocks): wrap to 2-3 per row (`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5`).
- [ ] Step 3 (Work style toggles): stack vertically (`grid-cols-1 lg:grid-cols-3`).
- [ ] Step 4 (Goals): `grid grid-cols-2 xl:grid-cols-5`.

**Fix approach:**
- Apply responsive grid columns to ensure items fit and stack logically.
- Make interactive buttons minimum 44x44px.

## Priority 9: Session Log — `components/app/session-log.tsx`

**375px issues:**
- [ ] Time range pushed to the right overflows.

**Fix approach:**
- Adjust flex direction to stack vertically on mobile (`flex-col md:flex-row`).
- Ensure time ranges render below the avatar/name on 375px.

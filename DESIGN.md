# AISC Webapp — UI Design System

This file is the **single reference** for adding a component or changing the UI in
the webapp. Before writing any JSX, read the relevant section below and reuse an
existing component or CSS class. When a reusable component does not exist yet,
**create one** (in `src/components/`) instead of inlining the pattern again.

If a change must ship fast, still follow these conventions; when a rule would
cost more than it saves, prefer the closest existing pattern and note the gap.

---

## 1. Layout shell

- `MyApp.tsx` renders `TopBar` (fixed, full-width) + `LeftBar` (collapsible
  navigation, `drawerWidth` 320 / `collapsedWidth` 72) + the routed page under a
  `<Toolbar>` offset. Every page renders inside this shell; never render your
  own full-page chrome.
- Pages are project-scoped: read the project id via `useProject()` →
  `projectUUID` (and `projectName` for routes/base links).
- Each page starts with a **page header** row (see §4) and then its content.

## 2. Color palette

Source of truth: `src/styles/common.css`, `src/index.css`, and the tokens below.

| Token | Value | Use |
|---|---|---|
| `gradient-btn` | `linear-gradient(135deg,#57a8ff,#2f7df6 48%,#0d47b8)` | Primary actions (Add, Save, Generate) |
| `gradient-btn:hover` | `#6ab4ff→#1554c7` + blue shadow | Hover state (defined in CSS, do not override) |
| Page header blue bar | `#001075` (TopBar AppBar) | Top app bar |
| AppDialog title bar | `#0048ff`, `dialog-paper-blue` gradient `#001075→#0020b5` | Modal header |
| `gradient-card` | light `#f7fbff→#e8f1ff` bg, border `rgba(28,92,198,.28)`, hover deepens | Default card surface |
| `plugins-card` | MUI outlined card (used as base class) | Secondary card surface |
| Selected/enabled border | `primary.main` (MUI ~`#1976d2`), 2px | "Selected" state |
| Semantic chips | success/info/warning/error MUI colors; risk impact `#7c3aed` (purple), likelihood `#ea580c` (orange), ready `#16a34a` | Chip coloring |
| Graph nodes | `#4561fb` border/hub, risk `#b45309` | CardGraph only |
| Grays / borders | `#e5e7eb` (borders), `#f9fafb` (drawer footer), `#374151` (secondary text) | Lines, dividers |

Do **not** invent new gradients/blues: reuse `gradient-btn`, `gradient-card`,
`plugins-card`, MUI palette semantics, and the tokens above.

## 3. Styling: CSS classes over inline `sx`

**Prefer a CSS file over inline `sx`.** The rule of thumb:

- Use the existing `common.css` classes (`gradient-card`, `plugins-card`,
  `gradient-btn`, `page-header*`, `wrap-chip`, …) or MUI defaults wherever
  possible.
- Keep `sx` for **one-off / contextual** layout that has no reusable meaning
  (a specific gap, a `cursor`, a `mt: 'auto'` bottom push). Do not crowd `sx`
  with repeated visual styling (borders, backgrounds, gradients, hover states)
  that belongs in a class.
- **When you need a new styling pattern that will be reused** (a card variant,
  a header treatment, a chip style, a layout class) — create a **named CSS
  class in a CSS file** (add to `src/styles/common.css` if it's app-wide, else
  a co-located `Component.css`) and use it; don't copy the same `sx` block into
  multiple places.
- Prefer a well-named CSS class over a long `sx` object every time the style
  is (or could be) shared by more than one spot.

## 4. Cards

The webapp is card-driven (grids of controllables). Build every grid card with
the shared `AppCard` (`src/components/AppCard.tsx`) so the layout is identical
everywhere: it applies the rules below and picks the surface for you.

```tsx
<AppCard
    theme="catalogue"              // the catalogue-card look (blue gradient when enabled, grey when not)
    active={enabled}            // gradient-card (or plugins-card when neither flag is set)
    onClick={() => open(item)}  // optional: makes the whole card clickable
    header={<Typography …>title</Typography>}
    footer={<>chips and actions</>}   // pinned to the bottom row
>
    {/* optional body between header and footer */}
</AppCard>
```

Catalogue cards (plugins, checklists, control objectives) use `theme="catalogue"`, styled by the `.catalogue-card` class in common.css.
They have no install/uninstall buttons: clicking the card enables or disables it
(install/uninstall, or set enabled), and the card shows an `installed` chip when
it is on.

Two card classes exist: `.gradient-card` (default surface) and `.plugins-card`
(MUI base). Pick:

- **Enabled / selected / active entity** → `active` (gradient-card).
- **Default / disabled / non-selected entity** → not `active` (plugins-card).

### Card layout rules (IMPORTANT)

- Cards that sit in a responsive grid **must** stretch to fill their cell and
  align actions across the row:
  ```tsx
  <Card className="X" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* title first */}
          {/* ...middle content... */}
          {/* action row LAST, pinned to the bottom: */}
          <Box sx={{ mt: 'auto', pt: 1, display: 'flex', ... }}>…</Box>
      </CardContent>
  </Card>
  ```
- **Chips, toggles, switches, and action buttons go in the bottom row**, pushed
  there with `mt: 'auto'` — never left dangling directly under the title. This
  keeps a row of cards visually aligned when cards have different content
  lengths. (Risk cards, questionnaire cards, catalogue cards all follow this.)
- Cards are clickable when the whole card is an action: add `cursor: 'pointer'`
  and `onClick`; stop propagation on nested interactive controls (Edit/Delete
  buttons, Key switch, checkboxes) so clicking them does not fire the card.
- Wrap a row of cards in `<Grid container spacing={2} className="plugins-grid">`
  (the grid class is a layout marker; keep using it for consistent spacing).

## 5. Page headers

Use the shared `.page-header*` classes from `common.css` — do not hand-roll:

```tsx
<Box className="page-header">
    <Typography variant="h4" className="page-header-title">Title</Typography>
    <Box className="page-header-controls">
        <Button variant="contained" className="gradient-btn" startIcon={<Icon>add</Icon>}>…</Button>
    </Box>
</Box>
```

- Title: `Typography variant="h4"` (or `h6` for a section inside a page).
- Actions on the right in `.page-header-controls`; primary action is a
  `gradient-btn`.

## 6. Buttons

- **Primary action** → `<Button variant="contained" className="gradient-btn">`
  (textTransform `'none'` where a custom label is used). Never re-implement the
  gradient inline; always the class.
- **Secondary** → `variant="outlined"`, `textTransform:'none'`.
- **Danger** → `variant="outlined"` (+ `color="error"`).
- Icon-only buttons: `<IconButton size="small">` with a Material `Icon`
  (`edit`, `delete`, `add`, `close`, …) — the app uses the MUI `Icon` ligature
  font (import `Icon from '@mui/material/Icon'`), not only SVG components.
- Disable while a matching async op is running (`disabled={busy !== null}` /
  per-item busy state).

## 7. Dialogs and drawers (reusable shells — USE THESE)

- **Dialog** → `src/components/AppDialog.tsx`. It owns the blue title bar, the
  white scrollable body and a pinned footer:
  ```tsx
  <AppDialog open onClose maxWidth="md" fullWidth title="…"
      actions={<Button …>Save</Button>}>
      {children}
  </AppDialog>
  ```
- **Right-hand drawer** → `src/components/SideDrawer.tsx`. Supports `mode`
  (`view`/`edit`/`static`), a header version dropdown (`versions`,
  `selectedVersionId`, `onSelectVersion`, `onPreviewVersion`), `headerAction`
  slot, resize handle, Esc-to-close, and an edit footer (`onSave`, `onCancel`,
  `footerActions`):
  ```tsx
  <SideDrawer open onClose title mode="view|edit" versions=… headerAction=…>
      {children}
  </SideDrawer>
  ```
- **Do not** open a `Dialog` where a `SideDrawer` fits (and vice-versa): use a
  dialog for short modal decisions/forms, a drawer for panel-style detail/editing
  of a selected item (entries, answers, cards). Version history lives in the
  drawer header dropdown, checkbox-selects, label-click previews.
- Nested interactive controls inside dialogs/drawers get `stopPropagation`.

### Version / history dropdown semantics (IMPORTANT)

The drawer-header version dropdown is the single way to navigate a “history”
(questionnaire config versions, answer versions, AI-card versions, checklist
submission versions, risk versions). Its two interactions mean different things
— keep them distinct everywhere:

- **[x] checkbox click = select / set the default version used.** It marks the
  version that is (or will be) the active one — e.g. the questionnaire config
  revision being edited, the answer set being worked on. Wired to
  `onSelectVersion`.
- **label (the version text) click = preview.** It only *shows* that version in
  the drawer — updates the fields/view to that revision without committing it as
  the default. Wired to `onPreviewVersion`.
- Both usually render the same content, but preview must never change the
  “default” selection state (the checkbox highlight) unless the user ticks the
  box.

Rules when building a versions list for a drawer:

- Every entry needs a stable `id` that the navigate handler can resolve: answer
  versions keyed by the qualification/submission `pid`, config version entries
  keyed by `String(number)`.
- The navigate handler must handle BOTH id kinds when a drawer shows a mixed
  history (answer versions + questionnaire definition versions): match the
  qualification pid first, then fall back to the config version number and load
  that revision’s definition/fields.
- If a drawer opens a “history” but no versions exist yet, still show the
  dropdown with a single `{ id: 'current', label: 'Current ...' }` entry so the
  control is discoverable.

### Export / Import JSON pattern

Drawers that edit a JSON-backed document (questionnaire definition, answers, AI
card) expose Export and Import as **icon buttons with tooltips**, matching the
plugin configuration drawer (`PluginsConfig`, `Plugins`):

```tsx
<Tooltip title="Export JSON">
    <IconButton size="small" aria-label="Export answers" onClick={exportAnswers}>
        <Icon fontSize="small">file_download</Icon>
    </IconButton>
</Tooltip>
<Tooltip title="Import JSON">
    <IconButton size="small" aria-label="Import answers" onClick={() => fileRef.current?.click()}>
        <Icon fontSize="small">file_upload</Icon>
    </IconButton>
</Tooltip>
```

Place them in the drawer's `footerActions` (answers) or `headerAction` (AI card).
Download via a temporary `<a>` blob link; import via a hidden
`<input type="file" accept="application/json,.json">` routed to the same ref.
Each button carries an `aria-label` so it stays accessible and testable.

## 8. Forms

- Compose with MUI `TextField`, `TextField select` (+ `MenuItem`), `Checkbox`,
  `Switch`, `TextField multiline`, `Stack`/`Box` for layout.
- Validation hints via `helperText`; errors inline near the field; the block
  **error** states use the page-level `error` `Typography color="error"`.
- Ignore/archive any old full-page `.css` form files when the component is
  rewritten; keep using MUI spacing (`gap`, `spacing`) over magic margins.
- Full-screen editing flows use `Dialog fullScreen` only for card graph editing
  (`QualificationPage` full screen card); everything else prefers `SideDrawer`.

## 9. Tables / data grids

- Dense tabular data with columns of raw values → MUI **`DataGrid`**
  (`@mui/x-data-grid`, `GenericCsvDataGrid` for raw CSV). Give columns `flex`/`minWidth`; keep density default.
- Style every `DataGrid` with `className="app-data-grid"` (defined in
  `common.css`): no-wrap cells with ellipsis, no focus outline, and a light blue
  gradient header with bold, primary-tinted titles. Do not repeat the look inline.
- Do not build ad-hoc `<table>` grids for measurements — reuse the existing
  generic grid/`DataGrid` building blocks.

## 10. Notifications (toast)

- User-facing confirmations/blocking errors are **toasts**, not silent state:
  `react-hot-toast` is already wired in `main.tsx` (`<Toaster />`,
  bottom-right default).
  ```tsx
  import toast from 'react-hot-toast';
  toast.error('This control objective is used by at least one risk — remove the risk mapping before disabling it.');
  toast.success(`Uploaded \`${name}\``);
  ```
- Use `toast.error` for blocked actions and failures, `toast.success` for
  completed async work. Keep the page-level `error` Typography for background
  load failures only.

## 11. Reusable component index

Create new shared components in `src/components/` when a pattern recurs:

- `AppDialog` — modal shell (title bar + body + pinned actions).
- `SideDrawer` — right panel shell (header version dropdown, resize, footer).
- `AICardView`, `CardGraph`, `NodeEditorDialog` — qualification AI-card UI.
- `CatalogueExploreDialog` — catalogue browsing (search + tag filter + install).
- `RiskRegisterSection` — risk register block (cards + edit dialog + versions).
- `InfoBanner` — small grey info strip above a form/table.
- `ReportSettings`, `PagePlaceholder`, `ZipFileList`,
  `GenericCsvDataGrid` — page-building blocks.
- `common.css` — `gradient-card`, `plugins-card`, `gradient-btn`,
  `page-header*`, `wrap-chip`, dialog paper/content classes.

If your component is a clearly reusable primitive (e.g., "a grid card with a
bottom action row", "a section header"), add it to `src/components/` with a
`*.css` if needed and import it — do not copy-paste the JSX into a page.

## 12. Conventions checklist (before shipping a UI change)

1. Reused `AppDialog` / `SideDrawer` instead of raw `Dialog`/`Drawer`? ✔
2. Used `gradient-btn` button + `.page-header` classes, not inline blue? ✔
3. **Styling lives in a CSS class where reusable — not jammed into `sx`
   (new class created in `common.css` or a `Component.css` when a pattern is
   shared)?** ✔
4. Cards use `gradient-card`/`plugins-card`; actions/chips/toggles pinned to
   the bottom with `mt:'auto'`; equal heights in the grid? ✔
5. Toast for notifications, page-level `error` only for background loads? ✔
6. Color came from the palette §2, not a new hex? ✔
7. Grid content wrapped in `plugins-grid`, spacing 2? ✔
8. `stopPropagation` on nested controls inside clickable cards/dialogs? ✔

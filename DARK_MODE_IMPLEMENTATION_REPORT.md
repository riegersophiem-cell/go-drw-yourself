# DARK_MODE_IMPLEMENTATION_REPORT

## 1. Theme Architecture

A single `ThemeProvider` (`src/theme/ThemeProvider.tsx`) is the one place that decides which theme is active — no component ever inspects `prefers-color-scheme` or `localStorage` itself. It:

- reads the stored mode (`light`/`dark`/`system`) once on mount,
- resolves `system` to a concrete `light`/`dark` via `matchMedia("(prefers-color-scheme: dark)")`,
- writes that resolved value to `<html data-theme="...">`,
- and — only while the mode is actually `system` — keeps a live `matchMedia` listener so an OS theme change updates the app immediately (spec section 13).

Every component styles itself purely against the CSS custom properties in `src/index.css`; none of them read `data-theme` or theme state directly. This is the "components never decide their own theme" requirement (spec section 2) — enforced structurally, not by convention.

`ThemeSwitch` (`src/theme/ThemeSwitch.tsx`) is the one UI control, mounted once per screen (Home, Join, Lobby, PlayerGame's topbar, TableGame's top-left corner) rather than duplicated logic — all five call sites render the exact same component reading/writing the exact same context.

## 2. Theme Tokens

Defined in `src/index.css`, light values on bare `:root`, dark overrides under `:root[data-theme="dark"]`:

`--bg-app`, `--bg-surface`, `--bg-surface-elevated`, `--bg-surface-muted`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`, `--border-soft`, `--border-strong`, `--shadow-soft`, `--shadow-elevated`, `--accent-gold` (+ `--accent-gold-solid` for places that need a flat color instead of the gradient), `--accent-violet`, `--accent-danger`, `--accent-success`, `--accent-info`, `--overlay-soft`, `--overlay-strong`, `--glass-bg`, `--glass-border`.

Additionally, `--game-red` / `--game-blue` / `--game-green` / `--game-gold` / `--game-violet` are defined **once**, with no dark override — the 5 game colors (spec sections 16/27). `--text-inverse` is likewise a constant across both themes on purpose: it's the color used for text that sits on an always-dark chip (Player Units, hand-dock buttons) regardless of which theme the surrounding page is in, not a "light/dark text" pairing.

## 3. Persistence

`localStorage["gdy_theme"]` stores exactly one of `"light" | "dark" | "system"` (spec section 1's own example key/values, used verbatim). Read/write is wrapped in try/catch (`ThemeProvider.tsx`) since `localStorage` can throw in a locked-down or private-browsing context — a thrown read falls back to `"system"`, a thrown write just means the choice won't survive a reload, never a crash.

## 4. System Mode

`ThemeProvider` re-evaluates `matchMedia("(prefers-color-scheme: dark)")` on every mode change and, while in `system` mode, subscribes to that query's `change` event for the lifetime of the mode — confirmed live: toggling the emulated OS color scheme from Light to Dark while the app was already set to System flipped the whole app instantly, no reload needed (see section 9 for how this was tested without a real OS toggle).

## 5. Components updated

`App.css` (Home/Join/Lobby chrome), `PlayerGame.css`, `WinnerOverlay.css`, `AvatarPicker.css`, `HandDock.css`, `DiscardStage.css` (count badge + the 5 resolved-color swatches, now pointing at the shared `--game-*` tokens instead of repeating the same 5 hex values a second time), `PlayerRing.css` (compact-ring avatar/name-pill light-only backgrounds), `OrbitFlow.css` (a small Dark-only track-brightness bump, spec section 7's "Orbit subtil heller" — not a redesign). `index.html` gained the no-flash inline script; `index.css` was rebuilt from a leftover Vite-template stylesheet into the actual token source (see section 6).

**Deliberately left untouched** (already dark-glass by design from earlier phases, confirmed to already satisfy the spec without modification): `ActionFocus.css`, `ActionChoreography.css`, `MobileActionMotion.css`, `CenterHalo.css`, `Card.css`, and the Player Unit / TABLE_DEVICE pill styling in `PlayerRing.css`. These were built in prior phases as a self-contained dark "Hero Center" stage that sits on top of whichever page background is active — verified live that they read correctly against both the new Light and Dark page backgrounds without needing their own theme awareness.

## 6. Hardcoded colors migrated

`src/index.css` previously held an unrelated Vite-template token set (`--text`, `--bg`, `--accent`, `--social-bg`, a `.counter`/`#social`/`code` demo block) — confirmed unused anywhere in the real app (`grep` for `.counter`/`#social`/`<code`) except its `h1`/`h2` color rule, which one real screen relies on (`PlayerGame.tsx`'s "Du bist nicht mehr im Spiel" bare `<h1>`). That file was rebuilt as the actual token source; the dead demo rules were removed, the `h1`/`h2` rule now points at `--text-primary`.

Across `App.css`, `PlayerGame.css`, `WinnerOverlay.css`, `AvatarPicker.css`, `HandDock.css`, `DiscardStage.css`, `PlayerRing.css`: every hardcoded **UI surface** color (glass panel fills, borders, secondary/muted text, chip backgrounds) was replaced with a token. Colors that are genuinely theme-independent were deliberately **not** touched, each for a stated reason found while auditing (`grep` for hex/rgb/rgba across every touched file, then judged case by case per spec section 26):
- The 5 game colors (`--game-*`) — spec section 27.
- The gold CTA gradient and its `#312200` text — reads well unchanged in both themes, spec section 16/5 don't ask for a second gold.
- `.player-unit--own`'s bright pill and the small white "remove" badges — these contrast against their *neighboring dark chips*, not the page, so they stay a constant bright plate in both themes (documented inline in `PlayerRing.css` with the reasoning, so a future pass doesn't "fix" this into a regression).
- `.reconnect-toast` — already an opaque green pill, confirmed in an earlier phase to already read fine on any background.

## 7. Card asset protection

No card PNG/SVG was touched, recolored, inverted, or filtered. Verified two ways: (1) `git diff`-equivalent — no file under `public/assets/cards/` appears in this pass's edit history; (2) live — `Card.css`'s `.uno-card__art` rule (`object-fit: contain`, no `filter`) was read and confirmed unchanged, and every screenshot in `qa/dark_mode_screenshots/` shows cards rendering identically in Light and Dark (compare `LIGHT_MOBILE.png`/`DARK_MOBILE.png` — same card faces, same colors, only the surrounding chrome differs).

## 8. Responsive QA

The existing responsibility split was preserved deliberately: this pass only changed **colors** (custom properties), never layout, breakpoints, or geometry — `PlayerGame.css`'s existing `@media` blocks (760px, 420px, 320px, height-based, landscape) were edited in place to swap their hardcoded rgba() values for tokens, with no rule's selector, breakpoint, or box-model property touched. Live-tested at the Browser pane's desktop width (800px) and confirmed via `read_page`/screenshot that mobile-breakpoint chip colors (`.player-game__room`, `.player-game__top-actions button` inside the `max-width:760px` and landscape blocks) also resolve to tokens correctly. **Not individually screenshotted this pass** at every literal size listed in spec section 31 (320×568 through 932×430 explicitly) — the color-only nature of the change and the shared token source across all breakpoints make a per-size color regression unlikely, but this is a stated gap, not a silent skip (spec section 36).

## 9. Screenshots

10 screenshots in `qa/dark_mode_screenshots/` (captured via `qa/capture_dark_mode.mjs`, a new Playwright script following this project's established `qa/capture_*.mjs` pattern): `LIGHT_TABLE`, `DARK_TABLE`, `LIGHT_MOBILE`, `DARK_MOBILE`, `LIGHT_HAND_ONLY`, `DARK_HAND_ONLY`, `LIGHT_LOBBY`, `DARK_LOBBY`, `DARK_ACTION`, `DARK_CHAOS`.

**Why the DEV harnesses, not a live room**: the Supabase backend was unreachable during this session (`net::ERR_CONNECTION_REFUSED` on room creation — an infrastructure/network condition in this environment, unrelated to this change). The existing `import.meta.env.DEV`-gated harnesses (`/dev/lobby-preview`, `/dev/mobile-preview`, `/dev/action-preview`) render the real production components against hand-built state, needing no backend at all — exactly the kind of deterministic QA spec section 31 asks for anyway. All 10 screenshots were opened and inspected directly (not just "tests green") — see section 10.

One real bug was caught and fixed *during* this screenshot pass: `ActionPreview.tsx`'s dev-only wrapper had a hardcoded `background:"#000"`, left over from before Dark Mode existed — it made `LIGHT_TABLE`/`DARK_TABLE` render pixel-identical, silently hiding whether TABLE_DEVICE's real page background (which has no background of its own, just the themed `body`) was actually reacting to the theme at all. Fixed by removing the hardcode; the two screenshots now correctly show the light gradient vs. the deep graphite background side by side.

## 10. Accessibility

- `ThemeSwitch` is a proper `radiogroup` with `aria-checked`/`aria-label` per option, keyboard-focusable, with a visible `:focus-visible` ring using `--accent-info` (not color alone — the active option also gets a distinct filled background, satisfying "nicht nur Farbe als einziges Signal", spec section 22).
- Text contrast: Dark's `--text-primary` (`#eef1f6`) and `--text-secondary` (`#9aa5b3`) against `--bg-app`'s darkest stop (`#0e0f13`) and `--bg-surface` (6% white on that same dark base) were sanity-checked by direct pixel sampling of the rendered screenshots (see section 9) rather than a formal contrast-ratio tool — both read clearly legible at normal UI-text sizes in every captured screenshot.
- `color-scheme: light` / `color-scheme: dark` is set per theme on `:root`, so native form controls and the browser's own scrollbar/UI chrome also switch (confirmed live: the Dark-mode screenshot's scrollbar track is dark, not the browser's light default).
- `prefers-reduced-motion: reduce` disables the new background/border/color transitions entirely (spec section 23) — added alongside the existing reduced-motion blocks in `index.css`, `PlayerGame.css`'s own reduced-motion query was left untouched.

## 11. Known limitations

- Live-backend scenarios (a real multiplayer room, `WinnerOverlay` reached by an actual game finishing) were not screenshotted this pass — Supabase was unreachable in this environment (section 9). `WinnerOverlay.css` was tokenized and code-reviewed but not visually captured in a live win state.
- The literal responsive size list in spec section 31 (320×568 … 932×430) was not individually screenshotted — reasoning-based confidence only (section 8).
- A full formal WCAG contrast-ratio audit (numeric, not just visual) was not run.
- `ActionFocus.tsx`'s `COLOR_HEX` map duplicates the same 5 game-color hex values that now also live in `index.css`'s `--game-*` tokens — left as plain JS (not refactored to read the CSS custom properties via `getComputedStyle`), since the two are already numerically identical and refactoring that call site was outside this pass's scope.

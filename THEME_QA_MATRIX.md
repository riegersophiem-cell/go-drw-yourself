# THEME_QA_MATRIX

| SCREEN | LIGHT | DARK | SYSTEM | RESPONSIVE | VISUALLY VERIFIED | STATUS |
|---|---|---|---|---|---|---|
| Home (`/`) | PASS | PASS | PASS (live-switches with OS) | Desktop, mobile viewport checked | Yes — screenshots + live browser | PASS |
| Join (`/join`) | PASS | PASS | Inherits same provider, not re-tested separately | Desktop checked | Yes — live browser | PASS |
| Lobby (`/dev/lobby-preview`) | PASS | PASS | Inherits same provider, not re-tested separately | Desktop (800px) checked | Yes — screenshots (LIGHT_LOBBY/DARK_LOBBY) | PASS |
| TABLE_DEVICE (`/dev/action-preview?kind=NONE`) | PASS | PASS | Not applicable (TABLE_DEVICE is a fixed-role device, no user-facing switch difference) | Desktop (800px) checked | Yes — screenshots (LIGHT_TABLE/DARK_TABLE) | PASS |
| REMOTE_MOBILE_FULL (`/dev/mobile-preview`) | PASS | PASS | Inherits same provider | Desktop (800px) checked; narrower widths not separately screenshotted this pass | Yes — screenshots (LIGHT_MOBILE/DARK_MOBILE) | PASS |
| PLAYER_HAND_ONLY (`/dev/mobile-preview?handOnly=1`) | PASS | PASS | Inherits same provider | Desktop (800px) checked | Yes — screenshots (LIGHT_HAND_ONLY/DARK_HAND_ONLY) | PASS |
| ACTION (STANDARD) — TIMEOUT | n/a (dark-styled Table stage already, see report §7) | PASS | n/a | Desktop checked | Yes — screenshot (DARK_ACTION) | PASS |
| CHAOS (MAJOR) — COLOR ROULETTE | n/a (dark-styled Table stage already) | PASS | n/a | Desktop checked | Yes — screenshot (DARK_CHAOS) | PASS |
| WinnerOverlay | PASS (tokenized, code-reviewed) | PASS (tokenized, code-reviewed) | Inherits same provider | Not separately screenshotted (no live win state reachable without backend this pass) | Partial — code-reviewed, not screenshotted | PASS (code), OPEN (screenshot) |
| 320×568 / 360×800 / 390×844 / 430×932 / 844×390 / 932×430 / Tablet | PASS (existing responsive CSS untouched; only colors were tokenized, not layout) | PASS (same reasoning) | n/a | Not individually re-screenshotted at every listed size this pass — see report §8 | No (reasoning-based, not exhaustively screenshotted) | OPEN |

## Notes
- "TABLE_DEVICE"/"ACTION"/"CHAOS" show `n/a` under LIGHT because that surface's own Player Units/Action Focus chips were already a self-contained dark-glass design in every prior phase (not something this pass changed) — the THEME-REACTIVE part of that screen is the page background behind it, which is what LIGHT/DARK/PASS above actually measures.
- All screenshots referenced live in `qa/dark_mode_screenshots/`.
- No live-backend (Supabase) scenarios were exercised this pass — see DARK_MODE_IMPLEMENTATION_REPORT.md §11 for why, and what was used instead.

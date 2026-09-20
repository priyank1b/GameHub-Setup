# GameHub v1.0.1 — Controller Support Phases

## Objective

Add full game-controller support to GameHub so a user can operate the GameHub UI with a controller without removing or breaking existing mouse/keyboard functionality.

Target release: **v1.0.1**

The controller should work for:
- Xbox/XInput controllers
- PlayStation controllers where exposed by Windows/Chromium
- Generic USB/Bluetooth gamepads supported by the Windows/Electron runtime

The controller operates **GameHub's UI**. It does not replace the controller input received by the launched game.

---

## Non-Negotiable Requirements

1. Existing mouse and keyboard controls must continue to work.
2. Controller support must be additive.
3. Do not require users to install Node.js, drivers, runtimes, or extra applications.
4. Do not interfere with the controller once a game has been launched.
5. Do not add unnecessary native dependencies unless the existing architecture proves the Web Gamepad API insufficient.
6. Do not change existing launcher/DRM behavior.
7. Do not scan or modify game files because of controller support.
8. Do not store unnecessary controller data.
9. Controller disconnect/reconnect must not crash or freeze the application.
10. All controller functionality must work in the packaged Windows EXE, not only in development mode.

---

# Phase 1 — Codebase and Architecture Audit

### Goals
Understand the existing UI, routing, focus behavior, Electron preload architecture, and build process before changing code.

### Tasks
- Inspect the current React/Vite/Electron architecture.
- Identify the root UI shell and navigation structure.
- Identify reusable interactive components:
  - sidebar
  - game cards
  - buttons
  - menus
  - dialogs/modals
  - search
  - settings
  - game details
  - notifications
- Identify whether the application already uses keyboard focus or shortcuts.
- Verify `nodeIntegration: false` and `contextIsolation: true` remain intact.
- Determine where controller state should live.
- Determine whether the browser/Electron Gamepad API is available in the current packaged Electron version.

### Deliverables
- Architecture notes
- Controller integration point
- No unnecessary dependency additions

### Acceptance
Controller implementation has a clear location and does not require restructuring the application.

---

# Phase 2 — Controller Detection and Lifecycle

### Goals
Detect connected controllers reliably.

### Tasks
Implement:
- controller connection detection
- controller disconnection detection
- reconnect handling
- multiple-controller detection
- active-controller selection
- controller capability/name display where available

Use the Web Gamepad API where supported.

Listen for:
- `gamepadconnected`
- `gamepaddisconnected`

For continuous button/stick state, use a controlled polling loop with `requestAnimationFrame` or an equivalent lifecycle-safe mechanism.

### Requirements
- No busy loop that consumes excessive CPU.
- Stop polling when unnecessary.
- Clean up listeners on component/application teardown.
- Do not throw if no controller exists.
- Do not assume a specific controller model.

### Acceptance
Connecting/disconnecting a controller while GameHub is open does not crash or freeze the application.

---

# Phase 3 — Controller Input Abstraction

### Goals
Create one normalized controller-input layer instead of scattering raw button numbers throughout the UI.

### Create
A controller abstraction such as:

- `ControllerManager`
- `ControllerState`
- `ControllerAction`
- `ControllerMapping`

Exact names should follow the existing project conventions.

### Normalized actions

Minimum actions:

- `NAV_UP`
- `NAV_DOWN`
- `NAV_LEFT`
- `NAV_RIGHT`
- `CONFIRM`
- `BACK`
- `MENU`
- `SECONDARY`
- `PAGE_UP`
- `PAGE_DOWN`
- `TAB_NEXT`
- `TAB_PREVIOUS`
- `SEARCH`
- `PLAY`
- `FAVORITE`

Not every action needs a dedicated physical button; actions may be context-dependent.

### Requirements
- Support standard Gamepad mapping where available.
- Avoid hardcoding only Xbox button labels.
- Internally normalize Xbox/PlayStation/generic mappings.
- Keep physical-button detection separate from UI actions.
- Include dead-zone handling for analog sticks.
- Prevent repeated navigation caused by a held stick/button.

### Acceptance
UI code receives normalized actions rather than raw controller button indexes wherever practical.

---

# Phase 4 — Focus and UI Navigation System

### Goals
Make every important GameHub UI element reachable by controller.

### Requirements

Implement a predictable focus model.

Controller navigation should support:

- Up/down navigation
- Left/right navigation
- Enter/confirm
- Back
- Scrolling
- Sidebar navigation
- Game-grid navigation
- Dialog navigation
- Settings navigation
- Search activation
- Context/menu navigation

### Focus rules

- Exactly one logical UI element should be considered controller-focused at a time.
- Focus must be visually obvious.
- Focus must never disappear when moving between sections.
- When returning to a previous screen, restore the previous logical focus when possible.
- Disabled elements cannot receive focus.
- Hidden elements cannot receive focus.
- Modal dialogs trap controller focus inside the modal.
- Closing a modal returns focus to the triggering element.

### Acceptance
A user can navigate the main GameHub interface without touching mouse or keyboard.

---

# Phase 5 — Main Library Controller Navigation

### Goals
Make the main game library fully controller-operable.

### Controller behavior

#### Main screen
- D-pad/left stick: move through UI
- A/Cross: confirm
- B/Circle: back
- Y/Triangle: search or context action according to UI context
- Menu/Options: application menu/context menu where appropriate

#### Game grid
- Left/right: move across cards
- Up/down: move between rows
- Confirm: open game
- Secondary action: favorite/context action if supported

#### Game details
- Confirm on Play: launch game
- Navigate metadata/actions
- Back: return to library

### Requirements
- Grid navigation must work with incomplete final rows.
- Focus must not jump unpredictably.
- Navigation should remain usable with large libraries.

---

# Phase 6 — Search, Filters, Favorites, and Recently Played

### Goals
Make secondary library functions controller-accessible.

### Support
- Open search
- Focus search input
- Navigate search results
- Clear search
- Open filters
- Select/deselect filters
- Navigate favorites
- Navigate recently played

### Text input

When a controller activates a text field:
- Keep the normal keyboard available.
- Do not implement a custom on-screen keyboard unless required by the existing product design.
- Do not steal controller input from an active text field in a way that makes typing impossible.

If an on-screen keyboard is already part of the project, integrate with it rather than creating a duplicate.

---

# Phase 7 — Settings and Dialogs

### Goals
Make settings and modal dialogs controller-operable.

### Support
- Settings categories
- Toggles
- Dropdowns/selectors
- Buttons
- Confirmation dialogs
- Error dialogs
- Import/export dialogs where applicable

### Safety
Destructive actions must require the same confirmation as mouse/keyboard interaction.

Controller confirmation must never accidentally trigger destructive actions from stale focus.

---

# Phase 8 — Controller Settings

### Goals
Provide basic controller configuration without overcomplicating v1.0.1.

### Add a Controller section to Settings

Show:
- Controller connected/disconnected status
- Detected controller name when available
- Active controller
- Enable/disable controller navigation
- Optional vibration preference only if vibration can be supported reliably

### Optional
- Button mapping screen
- Stick sensitivity
- Dead-zone setting

Only implement remapping if the existing architecture can support it cleanly. It is not required for v1.0.1.

---

# Phase 9 — Controller UX Polish

### Goals
Make controller operation feel intentional rather than like keyboard emulation.

### Add
- Visible focus ring/highlight
- Smooth focus transitions
- Stick dead zone
- Input repeat delay
- Input repeat interval
- Clear controller prompts where useful

### Avoid
- Excessive animations
- Large focus effects that obscure artwork
- Input lag
- accidental double activation

---

# Phase 10 — Game Launch Boundary

### Goals
Ensure controller support does not interfere with actual games.

### Requirements
Before launching:
- GameHub handles controller UI normally.

After launching:
- GameHub must not attempt to capture or remap controller input.
- Do not inject controller input into the game.
- Do not install virtual controller drivers.
- Do not modify game controller configuration.

When GameHub regains focus:
- Controller navigation should resume normally.

---

# Phase 11 — Packaging and Production Integration

### Goals
Ensure controller support works in the real Windows installer.

### Tasks
- Verify Electron packaged runtime supports the required Gamepad API.
- Rebuild native dependencies if the existing project uses any.
- Build Windows installer.
- Test the installed EXE, not only Vite/Electron dev mode.
- Verify controller support after fresh installation.
- Verify controller support after upgrade from v1.0.0.

### Acceptance
Controller support works in the actual `GameHub-Setup.exe`.

---

# Phase 12 — Regression Testing

### Test controllers

At minimum:
- Xbox controller
- PlayStation controller if available
- Generic USB/Bluetooth controller if available

### Test states
- Controller connected before GameHub starts
- Controller connected after GameHub starts
- Controller disconnected while navigating
- Controller reconnected
- Multiple controllers connected
- No controller connected
- Controller used while mouse is being used
- Controller used while keyboard is being used

### Test UI
- Home/library
- Game grid
- Game details
- Search
- Filters
- Favorites
- Recently played
- Settings
- Dialogs
- Error messages
- Context menus
- Scrolling

### Test game lifecycle
- Navigate with controller
- Launch a game
- Return to GameHub
- Continue navigating
- Close/reopen GameHub

---

# Phase 13 — Performance and Security Review

### Performance
Verify:
- no high CPU usage from polling
- no memory leak
- no input lag caused by controller polling
- no renderer freeze

### Security
Verify:
- no new unrestricted IPC
- no new renderer access to Node.js
- no unnecessary filesystem permissions
- no controller data sent externally
- no changes to DRM/launcher security boundaries

---

# Phase 14 — Documentation

Update:
- `README.md`
- `CHANGELOG.md`

Document:
- controller support
- supported controller types
- basic controls
- known limitations
- Windows requirements

Do not claim support for a controller that was not actually tested.

---

# Phase 15 — v1.0.1 Release

### Version
Update:

```json
"version": "1.0.1"
```

### Release checklist
- All changes merged into `main`
- Production build created
- Fresh installation tested
- Upgrade from v1.0.0 tested
- Controller tested
- Keyboard/mouse regression tested
- Game launching tested
- No secrets/debug files included
- README updated
- CHANGELOG updated
- Git tag created:

```text
v1.0.1
```

- GitHub Release created
- New `GameHub-Setup.exe` uploaded
- v1.0.0 remains unchanged

---

# Definition of Done

GameHub v1.0.1 is complete when:

1. A user can operate the main GameHub UI with a controller.
2. Mouse and keyboard continue to work normally.
3. Controller connection/disconnection is handled safely.
4. Game cards can be navigated without a mouse.
5. A game can be opened and launched with a controller.
6. Search, settings, dialogs, favorites, and filters are controller-operable where applicable.
7. Controller input does not interfere with launched games.
8. The feature works in the packaged Windows installer.
9. Existing launcher functionality remains unchanged.
10. No security regression is introduced.
11. Documentation reflects the new feature.
12. `v1.0.1` is released without modifying the `v1.0.0` release.

# GameHub v1.0.1 — Controller Support Specification

## Purpose

Define the controller architecture and UX rules for GameHub v1.0.1.

GameHub is a Windows desktop application. Controller support is for controlling the GameHub interface. It must not inject, remap, or interfere with controller input received by a launched game.

---

# 1. Supported Input

Use the standard Web Gamepad API available in the Electron/Chromium runtime wherever possible.

Support standard-mapped controllers such as:

- Xbox/XInput
- PlayStation controllers exposed through Windows/Chromium
- Generic USB/Bluetooth gamepads

Do not hardcode the implementation around Xbox button indexes only.

Use standardized Gamepad mapping when available and provide a safe fallback for unknown controllers.

---

# 2. Normalized Actions

The application should consume semantic actions rather than raw button numbers.

Recommended action enum:

```text
NAV_UP
NAV_DOWN
NAV_LEFT
NAV_RIGHT

CONFIRM
BACK
MENU
SECONDARY

PAGE_UP
PAGE_DOWN

SEARCH
PLAY
FAVORITE
```

The exact TypeScript names can follow the existing project's conventions.

---

# 3. Default Standard Mapping

For a standard gamepad, use the conventional mapping:

```text
D-pad Up       → NAV_UP
D-pad Down     → NAV_DOWN
D-pad Left     → NAV_LEFT
D-pad Right    → NAV_RIGHT

Left Stick     → NAV_UP/DOWN/LEFT/RIGHT

A / Cross      → CONFIRM
B / Circle     → BACK
X / Square     → SECONDARY
Y / Triangle   → MENU / contextual action

LB / L1        → PAGE/section navigation where appropriate
RB / R1        → PAGE/section navigation where appropriate

Menu/Start     → MENU
View/Select    → SEARCH or secondary contextual action
```

Do not force every physical button to have a global meaning. Actions may be contextual.

---

# 4. Analog Stick Rules

Use a configurable dead zone.

Initial default:

```text
Dead zone: approximately 0.20
```

The value should be centralized and adjustable later.

Do not generate navigation events continuously at the raw polling rate.

Use:

```text
Initial movement
    ↓
repeat delay
    ↓
repeat interval
```

Suggested starting values:

```text
Initial repeat delay: ~300 ms
Repeat interval: ~100 ms
```

These are starting values and may be tuned after real-device testing.

---

# 5. Button Debouncing

A single button press should generate one logical activation.

Avoid:

```text
A pressed
→ multiple accidental clicks
```

unless intentional repeat behavior is configured for navigation.

Buttons used for confirmation should not repeatedly activate an action while held.

---

# 6. Focus Model

Controller focus is a logical UI focus, not necessarily the browser's native `:focus`.

Every controller-operable element should have:

- stable identity
- enabled/disabled state
- visibility state
- logical navigation relationship
- visible focused state

The focused element must be obvious.

Recommended visual treatment:
- subtle border/ring
- slight elevation or scale
- no excessive glow
- preserve existing GameHub visual design

---

# 7. Navigation Model

Prefer deterministic navigation.

For grids:

```text
LEFT  → nearest valid card to the left
RIGHT → nearest valid card to the right
UP    → nearest valid card above
DOWN  → nearest valid card below
```

For vertical menus:

```text
UP   → previous item
DOWN → next item
```

For horizontal action groups:

```text
LEFT  → previous action
RIGHT → next action
```

Do not allow focus to jump to hidden or disabled elements.

---

# 8. Modal Navigation

When a modal opens:

```text
Main UI
   ↓
Modal opens
   ↓
Focus moves to first appropriate modal control
   ↓
Controller navigation is trapped inside modal
```

When the modal closes:

```text
Modal closes
   ↓
Focus returns to the control that opened it
```

This applies to:
- confirmation dialogs
- settings dialogs
- menus
- error dialogs
- import/export dialogs

---

# 9. Search

When the user activates Search:

1. Open the existing search UI.
2. Focus the search input.
3. Allow normal keyboard text entry.
4. Controller navigation must not break normal text editing.
5. Controller can navigate the results.
6. Confirm opens the selected result.
7. Back exits search according to existing UI behavior.

Do not implement a custom on-screen keyboard for v1.0.1 unless the current UI already has one or testing proves it is necessary.

---

# 10. Game Grid

Expected behavior:

```text
D-pad/Stick
    ↓
Move between game cards

A/Cross
    ↓
Open game details

A/Cross on Play
    ↓
Launch game

B/Circle
    ↓
Return to previous screen
```

Favorites/context actions must follow existing GameHub functionality.

---

# 11. Main Menu / Sidebar

Controller should be able to:

- open sidebar/menu
- move between sections
- confirm section
- return to previous section
- close menu with Back

The sidebar must not trap focus after it is closed.

---

# 12. Settings

All existing user-facing settings should be reachable by controller where technically applicable.

Controls include:
- buttons
- toggles
- selectors
- dropdowns
- tabs
- navigation lists
- dialogs

Do not create a second settings system just for controller support.

---

# 13. Controller Settings

Add a controller area to the existing Settings screen.

Minimum:

```text
Controller Support
------------------
Status: Connected / Not connected

Controller:
[Detected controller name]

Enable controller navigation:
[ON/OFF]
```

Optional future settings:

```text
Dead zone
Input repeat delay
Button remapping
Vibration
```

Do not expose options that are not actually implemented.

---

# 14. Hot Plugging

If a controller connects while GameHub is running:

- detect it
- update controller status
- make it usable without restart

If the active controller disconnects:

- stop processing its input
- do not crash
- preserve the current UI state
- allow mouse/keyboard operation

If a controller reconnects:

- resume controller support
- restore logical focus where possible

---

# 15. Multiple Controllers

For v1.0.1:

- detect multiple controllers
- select a stable active controller
- avoid processing every connected controller simultaneously

If the user interacts with a different controller, the implementation may switch the active controller to the most recently active device.

Do not add multiplayer functionality.

---

# 16. Game Launch Boundary

Before launching:

```text
Controller → GameHub
```

During the launched game:

```text
Controller → Game
```

GameHub must not:

- capture controller input globally
- inject controller events
- remap game controls
- install virtual controllers
- alter game controller configuration

When GameHub regains focus:

```text
Controller → GameHub
```

---

# 17. Error Handling

Controller errors must never crash the application.

Examples:

- unsupported mapping
- malformed Gamepad object
- controller disconnect
- browser API unavailable
- multiple controllers
- invalid axis values

Fallback:

```text
Controller unavailable
    ↓
Mouse + keyboard continue normally
```

---

# 18. Privacy

Controller information should remain local.

Do not send:
- controller names
- button events
- device identifiers
- controller state

to external services unless a future feature explicitly requires it and the user is informed.

---

# 19. Performance

The polling implementation must:

- avoid unnecessary CPU usage
- clean up when no longer needed
- avoid duplicate animation loops
- avoid memory leaks
- avoid React state updates on every raw polling tick unless necessary

Prefer keeping rapidly changing controller state in a lightweight manager/ref and emit semantic actions to the UI.

---

# 20. Electron Security

Do not weaken existing Electron security.

Keep:

```text
nodeIntegration: false
contextIsolation: true
```

Do not expose unrestricted:

```text
fs
child_process
shell
```

to the renderer.

Controller support should normally remain inside the renderer/UI layer unless a specific existing Electron architecture requires otherwise.

---

# 21. Compatibility

The implementation must work in:

1. Development mode
2. Packaged Electron application
3. Installed Windows EXE

Packaged-app behavior is the final authority.

---

# 22. v1.0.1 Scope Boundary

Required:

- detection
- connect/disconnect
- D-pad
- analog navigation
- confirm
- back
- main library
- game grid
- game details
- play
- search
- settings
- dialogs
- visible focus
- packaged EXE support

Not required unless already easy and reliable:

- button remapping
- vibration
- on-screen keyboard
- controller profiles
- multiplayer
- Steam Input integration
- virtual controller drivers
- global controller hooks

# GameHub v1.0.1 — Controller Test Plan

## Release

Version: `1.0.1`

Feature: Controller support for GameHub UI

---

# 1. Environment

Test on Windows 10/11.

Test:
- Development build
- Packaged production EXE
- Fresh installation
- Upgrade from v1.0.0

---

# 2. Controller Matrix

Test as many as are physically available:

| Controller | Connection | Result |
|---|---|---|
| Xbox/XInput | USB | Required |
| Xbox/XInput | Bluetooth | Recommended |
| PlayStation | USB | Recommended |
| PlayStation | Bluetooth | Recommended |
| Generic gamepad | USB | Recommended |
| Generic gamepad | Bluetooth | Optional |

Do not claim support for hardware that was not tested.

---

# 3. Detection Tests

### T01
Start GameHub with no controller.

Expected:
- Application works normally.
- No errors.
- Mouse/keyboard work.

### T02
Connect controller while GameHub is open.

Expected:
- Controller is detected.
- Controller can navigate UI.

### T03
Start GameHub with controller already connected.

Expected:
- Controller is detected.

### T04
Disconnect controller during navigation.

Expected:
- No crash.
- UI remains usable with mouse/keyboard.

### T05
Reconnect controller.

Expected:
- Controller works again.

---

# 4. Navigation Tests

Verify:

- D-pad up
- D-pad down
- D-pad left
- D-pad right
- Left stick up/down/left/right
- Confirm
- Back
- Menu/context action
- Input repeat
- Dead zone

Expected:
- No accidental double activation.
- No excessive CPU usage.
- No focus loss.

---

# 5. Library Tests

Verify:

- Game grid
- Row navigation
- Incomplete final row
- Large game library
- Scrolling
- Game selection
- Game details
- Favorite
- Recently played

---

# 6. Search Tests

Verify:

- Open search
- Focus search
- Keyboard typing while search is active
- Search results
- Navigate results
- Open result
- Clear search
- Exit search

---

# 7. Settings Tests

Verify:

- Open settings
- Navigate categories
- Toggle setting
- Select option
- Save/apply if applicable
- Return to previous screen

---

# 8. Dialog Tests

Verify:

- Confirmation dialogs
- Error dialogs
- Menus
- Import/export dialogs
- Destructive-action confirmations

Expected:
- Focus trapped in modal.
- Back closes/cancels correctly.
- Confirm activates only the focused action.
- Focus returns to the opening element.

---

# 9. Game Launch Tests

Verify:

1. Select a known installed game.
2. Open details.
3. Select Play using controller.
4. Game launches.
5. Game receives normal controller input.
6. GameHub does not capture/remap controller input.
7. Return to GameHub.
8. Controller UI works again.

Test at least:
- Steam game
- Epic game
- GOG game
- Standalone game
- Other supported launcher where available

---

# 10. Mixed Input Tests

Test switching between:

```text
Controller → Mouse
Mouse → Controller
Controller → Keyboard
Keyboard → Controller
```

Expected:
- No focus corruption.
- No stuck input.
- No accidental activation.

---

# 11. Multiple Controller Tests

If multiple controllers are available:

- connect both
- determine active controller behavior
- use each controller
- disconnect active controller
- verify fallback

No crashes or duplicate actions.

---

# 12. Performance Tests

While controller polling is active:

- inspect CPU usage
- inspect memory usage
- leave GameHub idle for 30+ minutes
- navigate continuously
- connect/disconnect repeatedly

Expected:
- no memory leak
- no runaway CPU
- no renderer freeze

---

# 13. Security Regression

Verify:

- Electron security settings unchanged
- no unrestricted Node APIs in renderer
- no new unnecessary IPC
- no external controller telemetry
- game launcher behavior unchanged

---

# 14. Release Tests

Before v1.0.1:

- Build installer
- Install on clean Windows environment
- Verify controller support
- Upgrade from v1.0.0
- Verify existing library/database remains intact
- Verify games still launch
- Verify controller works after upgrade
- Verify uninstall behavior

---

# 15. Release Artifact

Final artifact:

```text
GameHub-Setup.exe
```

GitHub release:

```text
GameHub v1.0.1
Tag: v1.0.1
```

Do not replace or modify the v1.0.0 release.

---

# Definition of Done

All required tests pass.

Any unsupported controller behavior must be documented rather than silently claimed as supported.

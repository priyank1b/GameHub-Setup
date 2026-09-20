# GameHub v1.0.1 — Controller UI Navigation Specification

## Goal

Every important GameHub screen must have a deterministic controller navigation path.

Mouse and keyboard remain fully supported.

---

## Navigation Priority

When controller input is active:

1. Modal/dialog focus
2. Search/input focus
3. Sidebar/menu focus
4. Current screen's primary content
5. Secondary controls

Do not allow multiple UI areas to react to the same controller action.

---

## Home / Library

Expected focus order:

```text
Top navigation
    ↓
Sidebar
    ↓
Search / Filters
    ↓
Game grid
    ↓
Secondary actions
```

The exact order should follow the existing UI layout.

The first focusable element should be deterministic.

---

## Game Grid

Example:

```text
[A] [B] [C] [D]
[E] [F] [G] [H]
[I] [J] [K]
```

Navigation:

```text
A → B → C → D
↑   ↑   ↑   ↑
E → F → G → H
↑   ↑   ↑
I → J → K
```

At row boundaries, choose the nearest valid item instead of jumping to an unrelated card.

For incomplete rows, navigation should choose the nearest valid card.

---

## Game Details

Focus order should prioritize:

```text
Play
Favorite
Secondary game actions
Game information
Back
```

Confirm on **Play** must invoke the existing launch service rather than creating a separate controller launch path.

---

## Sidebar

```text
Open sidebar
↓
Focus first item
↓
D-pad/Stick navigation
↓
Confirm
↓
Navigate selected section
```

Back closes the sidebar if it is acting as an overlay.

---

## Search

```text
Search button
↓
Search input
↓
Results
```

Controller must not break keyboard typing.

---

## Filters

Filters should support:

- open
- move between options
- toggle/select
- apply
- cancel
- reset

Use the same existing filter logic as mouse/keyboard.

---

## Dialogs

Every modal must have:

- initial focus
- controller navigation
- Confirm
- Back
- focus trap
- focus restoration

For destructive dialogs:

```text
Cancel
Confirm
```

The safer option should not be accidentally activated by stale focus.

---

## Settings

Controller navigation must work for:

- settings categories
- controls
- toggles
- selectors
- action buttons

A setting change must use the existing settings/data layer.

Do not duplicate settings state.

---

## Focus Styling

Controller-focused elements should be visually distinct.

Recommended:
- visible outline
- subtle scale/elevation
- accessible contrast

Do not change the entire GameHub visual identity for controller support.

---

## Mouse/Keyboard Interaction

If the user moves the mouse:

- native mouse hover may update visual hover state
- controller logical focus should remain stable unless the UI intentionally transfers focus

If the user presses a keyboard navigation key:

- normal keyboard navigation continues
- controller state must not interfere

Controller support is additive.

---

## Accessibility

Do not rely solely on color to show focus.

Focus indication should remain visible against GameHub's existing dark UI.

Disabled elements:
- cannot receive controller focus
- cannot activate

Hidden elements:
- cannot receive controller focus

---

## Acceptance Criteria

A tester using only a controller must be able to:

1. Open GameHub.
2. Navigate the library.
3. Move through game cards.
4. Open a game.
5. Launch a game.
6. Return to GameHub.
7. Search for a game.
8. Use filters.
9. Favorite/unfavorite a game.
10. Open Settings.
11. Change a setting.
12. Open and close dialogs.
13. Return to the library.
14. Exit/close the relevant UI.

Mouse and keyboard must continue to work throughout.

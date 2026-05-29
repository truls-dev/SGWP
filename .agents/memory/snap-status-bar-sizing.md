---
name: Snap status bar sizing
description: How the snap fullscreen overlay's status bar must be sized to match the chat-mode status bar in the canvas renderer.
---

# Snap fullscreen status bar must match the chat status bar size

The snap fullscreen overlay is drawn AFTER the phone UI, in root canvas space (no
active transforms). Its status bar must visually match the chat-mode status bar.

**Rule:** To match the chat status bar, replicate the chat's *full effective
transform*, which is `phoneScale × uiScale` — NOT just the phone/video scale.

**Why:** The chat status bar is drawn inside the phone transform
(`scale(phoneScaleX, phoneScaleY)`) and then an additional `scale(uiScale)`, with
its layout width set to `this.W / uiScale`. `uiScale` defaults to **1.5**, so it is
the dominant size factor — easy to overlook. Earlier attempts only matched the
video/phone scale and the bar still came out far too small because the 1.5× uiScale
was missing. There were several wrong iterations (uniform vs non-uniform scale,
fullscreen vs phone-area) before finding that uiScale was the real gap.

**How to apply:**
- Store the phone's `phoneScaleX`/`phoneScaleY` wherever `phoneCanvasRect` is set
  (video mode: both = videoModeScale; non-video: x = safeScale `(W-40)/W`, y = 1).
- In the snap overlay: `sbScaleX = phoneScaleX * uiScale`, `sbScaleY = phoneScaleY * uiScale`,
  draw the status bar with `translate(pr.x, pr.y); scale(sbScaleX, sbScaleY)` and pass
  layout width `this.W / uiScale` to `drawStatusBar`.
- This makes effective canvas width = `(W/uiScale) * (phoneScaleX*uiScale) = W*phoneScaleX = pr.w`,
  so the bar spans exactly the phone-area width and never overflows.
- Keep the snap (black bg, image, bottom bar, dots) confined to `pr` (phone area) so
  the video background stays visible around it — do NOT expand to full canvas.
- `drawStatusBar` takes an optional `width` param (default `this.W`) used for the
  white-bg fill, the centered time (`width/2`), and the right-anchored battery/wifi
  (`width - 22`). Carrier is left-anchored and unaffected.

**Gotcha:** The main canvas is `getContext('2d', { alpha:false })`. Transparent PNG
pixels become opaque black, so `ctx.filter='invert(1)'` to recolor icons white
produces white SQUARES. Recolor via an offscreen alpha-enabled canvas with
`globalCompositeOperation='source-in'` instead (see `getWhiteIcon`).

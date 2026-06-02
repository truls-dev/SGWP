---
name: Snap-send editor view design
description: How the me-sent-snap fullscreen view recreates the Snapchat post-capture editor
---

# Snap-send editor view (drawSnapSendFullscreen)

The me-sent-snap fullscreen view recreates Snapchat's **post-capture editor** screen
(matching a user-supplied screenshot): black status-bar strip, captured photo below
it (rounded top corners), X close (top-left), a "sound" pill (top-center, shows
"Add a sound" — no real track field is plumbed), a right-hand vertical tool rail of
~12 icons, a download arrow (bottom-left), a friend-avatar carousel (one empty white
ring in the middle), and a bottom send bar with a "+ More Friends" pill plus the
recipient name + a solid white send arrow. A bottom gradient scrim sits under the
carousel/send bar. Recipient = `chatConfig.headerName || contactName`.

Tool icons are drawn vectorially by `drawSnapToolIcon` (+ `drawSparkle`), not images
or emoji (emoji load async and are unreliable during export).

**Why:** all chrome is drawn in **root canvas space** (no anisotropic transform
active) using `u = sbScaleX` for sizes and `arc()` for circles, so avatars/rings stay
round even in short-crop mode where `phoneScaleX !== phoneScaleY`.

**How to apply:** when adding chrome to any fullscreen snap view, draw circles with a
single-radius `arc()` in canvas space; do not rely on a scaled transform, or circles
distort in short-crop/video mode.

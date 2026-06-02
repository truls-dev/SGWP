---
name: Snap image data model
description: Where a snap's image lives differs for received vs me-sent snaps
---

# Snap image data model

For **received** snaps, the image is stored on the `OPEN_SNAP` event's `snapImageUrl`
(the SNAP bubble in chat carries no image; OPEN_SNAP triggers the fullscreen view).

For **me-sent** snaps, there is no OPEN_SNAP — the image lives on the `SNAP` event's
own `snapImageUrl`, and `snapDurationMs` controls how long the "Send to [recipient]"
camera view shows.

**Why:** received and me-sent snaps use different fullscreen flows
(`drawSnapFullscreen` vs `drawSnapSendFullscreen`), so the renderer preloads
`snap_${id}` for BOTH event types when `snapImageUrl` is present.

**How to apply:** any new snap rendering must read the image from the correct event
type. The renderer keys all snap images as `snap_${eventId}`.

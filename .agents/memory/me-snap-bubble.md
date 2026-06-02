---
name: Me-sent snap chat bubble (Delivered/Opened)
description: How a snap the "me" person SENT renders in the chat list and flips state during playback
---

# Me-sent snap chat bubble (drawMeSnapBubble)

A snap the "me" person sent does NOT use the received-snap card (drawSnapBubble).
`drawMessage` branches on `sender?.isMe` and calls `drawMeSnapBubble`: a white
rounded card with a red play-arrow (color #F4493C) — FILLED triangle + text
"Delivered" when unopened, OUTLINE triangle + text "Opened" once opened. It does
NOT record `snapOriginRect`/camBtn (me-snaps never zoom to fullscreen from the
bubble; only received snaps do).

State flip during playback: after the me-snap is appended (and recipient becomes
active), the playback loop waits ~1500ms then adds `event.id` to `snapOpenedIdsRef`
and mirrors it into `frameStateRef.current.snapOpenedIds`. The renderer reads opened
state via `currentSnapOpenedIds.has(msg.id)` where `msg.id === event.id`. The
duration estimator must add the same ~1500ms beat for me-snaps or exported video
length drifts.

**Why:** Snapchat shows a sent snap as "Delivered" (filled arrow) until the
recipient views it, then "Opened" (outline arrow). The opened set is keyed by the
event/message id, the same id the renderer looks up.

**How to apply:** keep the playback delay and the estimator delay in lockstep; both
currently 1500ms. Any change to one must change the other.

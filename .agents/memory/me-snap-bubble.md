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

State flip is TRIGGER-DRIVEN, not on a timer. The me-snap stays "Delivered" until
an OPEN_SNAP event whose `snapTargetId` points at it plays. The OPEN_SNAP playback
handler detects a me-target (find target SNAP in `seqScript`, its sender via
`seqCast`, check `.isMe`) and, for me-targets, just adds `snapTargetId` to
`snapOpenedIdsRef` + `frameStateRef.current.snapOpenedIds` and `continue`s after a
short delay — it SKIPS the received-snap fullscreen zoom flow. The renderer reads
opened state via `currentSnapOpenedIds.has(msg.id)` where `msg.id === snapTargetId`.

**Why:** the user explicitly rejected an automatic timed flip ("it should be
triggered"). Received snaps already require an OPEN_SNAP trigger; me-snaps reuse the
same explicit trigger for consistency, but with no fullscreen replay (a sender
doesn't re-open their own snap — the recipient viewing it is what flips the label).

**How to apply:** to flip a me-snap to "Opened", author an OPEN_SNAP event targeting
it (the target dropdown lists me-sent snaps). Do NOT reintroduce a time-based flip.

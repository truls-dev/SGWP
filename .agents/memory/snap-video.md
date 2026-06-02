---
name: Snap video support
description: How video (vs image) snaps are modeled, colored, and rendered
---

# Snap video support

A snap can be an image OR a video. The flag is `snapIsVideo?: boolean` on the
event that owns the media (same event that owns `snapImageUrl`). Both image and
video media are stored in `snapImageUrl` as a data URL — there is no separate
video field.

## Bubble color (purple #99529e when video)

The chat bubble is always the `SNAP` event, but for received snaps the video-ness
lives on the linked `OPEN_SNAP` event (keyed by `snapTargetId` -> SNAP id). So a
`snapVideoIds: Set<string>` is threaded through `FrameState` (mirroring
`snapOpenedIds`), keyed by **SNAP id** for both cases:
- me-sent SNAP with `snapIsVideo` -> add its own id
- OPEN_SNAP with `snapIsVideo` -> add its `snapTargetId`

The renderer caches it as `currentSnapVideoIds` and passes `isVideo` into both
`drawSnapBubble` (received square icon) and `drawMeSnapBubble` (me play-arrow);
purple `#99529e` replaces the red accent.

**Why:** the bubble has no direct access to the OPEN_SNAP that holds the media,
so video status must be precomputed and keyed by the bubble's (SNAP) id.

## Duration

For video snaps the duration auto-syncs to the video length: on upload, a probe
`<video>` reads `loadedmetadata` and sets `snapDurationMs = duration*1000` (with a
deterministic fallback if the probe fails). Image snaps keep a user-editable
duration.

## Rendering

`loadVideo` must skip the `/api/media-proxy` for `data:` URLs (it only proxies
http(s)). Fullscreen draws (`drawSnapFullscreen`, `drawSnapSendFullscreen`) prefer
the loaded video element (`gifVideos.get('snap_${id}')`) over the image. Snap
videos are seeked to 0 and played when a fullscreen/send view opens. Export uses
live video playback (no per-frame currentTime sync) — same best-effort model as
GIF/MP4 message media.

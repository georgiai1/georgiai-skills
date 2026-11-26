# Real capture and truthful edits

1. Identify the actual app/window and observed dimensions. Inspect the shortcut in that application/version/context, including modal dialogs, menus, keyboard layout and focus. Do not infer shortcuts from their labels or a previous app build.
2. Establish an authorized safe demonstration state. Ask the user to log in before capture. Hide notifications and unrelated sensitive windows; capture only the intended region. Do not create orders, invoices or other business records merely to make a scene work.
3. Make a short take per action: stable pre-roll, actual press, real result, stable hold. Record provisional press/result timestamps and the focus rectangle in private working metadata. Check the video afterward: recorder startup latency means script wall time is not an exact video timestamp.
4. Keep raw footage unchanged. Re-record a wrong action; do not manufacture a success state with graphics. Remove only selected waits, retain the order and outcome, and label the shortened wait on screen.

## Capture adapters

Use an available trusted recorder or OS automation tool; no desktop-control MCP is required by this skill. On Windows, FFmpeg with `gdigrab` can capture an observed window title. The recorder must stay running while the user/authorized automation performs the actions:

```text
ffmpeg -n -f gdigrab -framerate 30 -draw_mouse 1 -i "title=Observed Window Title" -an -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset ultrafast -crf 17 -pix_fmt yuv420p raw/take.mp4
```

Send `q` to its stdin to finish gracefully and wait for exit. Use a bounded recording time/watchdog in automation, keep background processes hidden on Windows, and check the resulting file before proceeding. `-draw_mouse 0` is appropriate for a keyboard-only demo. Window-title capture can miss detached dialogs or menus; test the chosen capture method first. `gdigrab` is Windows-only and capture support depends on the selected binary.

macOS and Linux need a platform-appropriate recorder (for example AVFoundation or X11/PipeWire through available tools) and OS screen-capture permissions. These adapters are not supplied or tested. If no recorder is available, request user-provided captures rather than claiming capture succeeded.

## Trim accounting

For retained intervals `[a,b)`, a source press at `p` inside one interval maps to `sum(length of earlier intervals) + p - a`. Round once to the nearest output frame. Reject plans that remove the press. Check the actual edited video at `pressFrame-1`, `pressFrame`, and `pressFrame+1`, because source frame sampling can shift the nearest frame. Derive result/zoom timing in the edited coordinate system too.

Long idle waits may be removed with `scripts/media.mjs trim`. A single head/tail trim is not a shortened internal wait; multiple intervals are marked as a cut by the helper. Explicitly disclose any visible speed-up or freeze you add manually. Preserve enough post-action time to make the result intelligible.

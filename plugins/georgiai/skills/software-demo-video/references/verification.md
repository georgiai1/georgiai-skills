# Verification checklist

Run `npm test` for config, timing, waveform and malformed-container checks. Run `npm run smoke` for a real small Remotion render from synthetic inputs, trimming, AAC mixing and video preservation. Inspect `out/smoke-*/preview.png`, play `final.mp4`, and read `verification.json`. Synthetic success does not test a real app or prove Claude skill discovery.

For the actual deliverable, run `media.mjs verify <config> <final> <master>`:

- Exact dimensions, integer fps and decoded frame count; duration within the frame/AAC tolerance.
- H.264, yuv420p and AAC, successful complete video/audio decoding.
- Decoded stereo sample peak below 0.95 (headroom, not a true-peak/LUFS certificate).
- `moov` before `mdat` for progressive MP4 playback.
- Identical compressed video digest to the master after an audio-only change.

The verification command reports planned click times; it does **not** claim it can detect arbitrary clicks under arbitrary music. The synthetic smoke test separately checks both tap energies, cross-correlates the click-only output with the expected waveform to within 1 ms, and subtracts a separately encoded bed to check the mixed click residual. That controlled test is not a universal detector for user audio.

Human/agent visual and listening review still needs to confirm:

1. Genuine app behavior, correct shortcut context, no private content, proper waiting disclosure.
2. Press-frame alignment with the real action (inspect adjacent frames), zoom after the real result, no essential UI cropped or covered.
3. Readable typography/logo/captions at intended playback size; correct Cyrillic; no missing media or black flashes at cuts.
4. Audible double tap at each press, quiet music, natural fades, no clicks at scene boundaries or unexpected app/narration loss.

Record exactly what ran, environment/dependency versions, output metadata, and untested adapters. If the Claude CLI is only installed, that is not a Claude invocation test. If a non-interactive run cannot authenticate, report the blocker; do not call it tested. Never publish raw logs containing local paths or credentials.

## Authoring validation (2026-11-24)

Tested on Windows with Node 22.18.0, Remotion 4.0.546 and the pinned FFmpeg wrappers. A fresh initialized project installed successfully with `npm ci`; all six Node tests passed. The five-second synthetic smoke export produced 150 frames at 1920×1080/30 fps, H.264 yuv420p/AAC, full decode and faststart. The video digest matched the silent master for both click-only and music versions. Controlled click correlation found zero-sample offset; mixed residual correlation was 0.9994 and decoded stereo sample peak was 0.0763 or lower. Representative frames were visually inspected, including Cyrillic and the wait disclosure.

Claude Code 2.1.295 validated the marketplace/plugin and completed two read-only, local-plugin invocations: missing capture/login and preserving narration from a mixed soundtrack. These confirmed instruction loading and planning behavior, not autonomous media production inside Claude. A separate Codex review exercised the same boundary cases. The skill frontmatter validator passed. No real desktop capture, HyperFrames, macOS/Linux execution or subjective listening was tested during package creation.

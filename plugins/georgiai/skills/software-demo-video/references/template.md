# Remotion project

Requires Node.js 22+, npm, and Chromium (Remotion can download its browser). FFmpeg/ffprobe are supplied by pinned npm wrappers; `FFMPEG_PATH`, `FFPROBE_PATH` can select locally installed binaries. `BROWSER_EXECUTABLE` can select Chrome/Chromium. Supply paths through environment variables, never edit machine-specific paths into the package.

From any shell, replace `<skill-folder>` and `<new-project>` with actual paths:

```text
node <skill-folder>/scripts/init-project.mjs <new-project>
cd <new-project>
npm ci
npm test
npm run smoke
```

The initializer refuses an existing destination. The smoke command generates a test pattern and tone, trims a wait, renders a five-second 1080p video, mixes clicks/music and verifies outputs in a new `out/smoke-<timestamp>/` directory. Everything is labeled synthetic. The template's `demo.json` is a separate 45-second example; its capture paths deliberately do not exist until you provide real recordings.

## Configuration

- `width`, `height`: positive even output dimensions. `fps`: positive integer. Frame counts, not fractional seconds, define duration.
- `scenes`: ordered cards/screens, each with unique `id`, `kind`, positive `frames` and `title`; optional `caption` and `keys` (split on `+`). For a literal plus key, adapt the renderer to an array of key labels.
- `pressFrame`: local zero-based edited-video frame. Omit for no sound/key press. `0` is valid. Leave 180 ms before scene end for the double-click tail. Global audio time is `(sum(previous frames) + pressFrame) / fps`.
- Screens require `file` relative to project `public/`, `sourceWidth`, `sourceHeight`. Do not put absolute paths or `..` here. Footage must be at least as long as the scene; explicitly trim or pad a verified last frame when needed.
- `focus`: `{x,y,width,height}` in source pixels. Set `zoomStartFrame` after the observed window opens and `zoomEndFrame` later within the scene. Zoom uses a smooth cubic curve. Coordinates change when capture size/cropping changes.
- `loadingCut: true`: show the configured `waitingLabel`. `synthetic: true`: show `syntheticLabel` in testing/mockup scenes. Do not label fabricated UI as real capture.
- `brand`: `name`, `accent`, `background`, `ink`, `fontFamily`; optional `logo` and `fontFile` relative to `public/`. System Arial is the default, with no font redistribution. A font file should include the needed Cyrillic glyphs.
- `audio`: `clickStyle` (`double`, `mechanical`, `soft`, `digital`), linear `clickGain`, `musicGainDb`, `duckDepth` (0–1), `fadeSeconds`. The example music gain is a starting point, not loudness normalization.

The layout is authored on a 1920×1080 stage and scaled to fit output dimensions. Other aspect ratios are letterboxed; redesign the layout for native portrait framing. It is not an automatic responsive editor.

## Commands (from the generated project)

```text
node scripts/media.mjs clicks out/click-options
node scripts/media.mjs trim raw/take.mp4 public/clips/one.mp4 edit-plan.json
node scripts/render.mjs demo.json out/press.png 174
node scripts/render.mjs demo.json out/master.mp4
node scripts/media.mjs mix demo.json out/master.mp4 out/final.mp4 public/music.wav
node scripts/media.mjs verify demo.json out/final.mp4 out/master.mp4
```

Omit the final music argument for clicks only. Each output must be new; choose a new filename for revisions. The render is silent; mix replaces all audio. Commands use argument arrays internally, not a shell-built FFmpeg command.

An edit plan uses source seconds:

```json
{"fps":30,"pressSeconds":2.3,"keep":[[0.5,3.1],[8.0,11.7]]}
```

This removes the 3.1–8.0 s interval and returns an estimated edited `pressFrame`. Copy it into the scene, check the adjacent frames, set `loadingCut`, and enter the observed focus rectangle. `trim` removes audio. It does not operate the app or infer when loading finished.

Memory limits: the verifier decodes the audio into memory (512 MB subprocess buffer), and the MP4 atom check reads the file. This is intended for short demos. For long exports, implement streamed peak/atom checks instead of raising limits blindly.

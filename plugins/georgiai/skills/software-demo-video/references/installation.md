# Claude Code installation and licenses

This package follows Claude Code's skill folder format: `SKILL.md` with YAML `name`/`description`, relative references and supporting resources. No Codex-specific tool names are required by the skill.

## Through the repository plugin (after the PR is merged)

```text
/plugin marketplace add georgiai1/georgiai-skills
/plugin install georgiai@georgiai
```

Then invoke `/georgiai:software-demo-video`. Existing users should update the marketplace/plugin via `/plugin` and restart their session as needed. A branch-only change is not available through the default marketplace until merged.

For local preview of a checkout containing the change:

```text
claude --plugin-dir ./plugins/georgiai
```

Run that from the repository root, then invoke `/georgiai:software-demo-video`.

## Standalone skill

Copy the complete `software-demo-video` folder (not just SKILL.md) into `~/.claude/skills/software-demo-video/` for personal use, or `<project>/.claude/skills/software-demo-video/` for a project. Invoke `/software-demo-video`. Preserve scripts, references and assets. Do not copy test output, `node_modules` or your recordings into the installed skill. The helper creates a separate editable project.

Primary references, consulted when authored:

- [Claude Code skills and supporting files](https://code.claude.com/docs/en/skills)
- [Claude Code plugins and local testing](https://code.claude.com/docs/en/plugins)
- [Remotion renderMedia](https://www.remotion.dev/docs/renderer/render-media) and [OffthreadVideo](https://www.remotion.dev/docs/offthreadvideo)
- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html), [FFmpeg stream copy](https://ffmpeg.org/ffmpeg.html#Stream-copy)

These instructions target local Claude Code. Installation/use in Claude web, Cowork or other hosts is not verified by this package; do not assume that copying a local folder installs it in those environments.

## Dependencies and distribution

The original instructions, helpers and template in this folder are MIT licensed (see `LICENSE`). No customer recordings, music, logos, proprietary fonts, application binaries or dependency binaries are shipped. The npm lockfile pins dependencies; install them in the generated project.

Remotion uses its own [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md), not MIT; review [current licensing eligibility](https://www.remotion.dev/license) for your organization/use. React is MIT. The `ffmpeg-static` package metadata specifies GPL-3.0-or-later and `ffprobe-static` specifies MIT; downloaded FFmpeg/ffprobe binaries have their own build/license obligations. Inspect the selected binary's `-version`/`-buildconf` and [FFmpeg legal guidance](https://ffmpeg.org/legal.html) before redistributing it. Installing dependencies does not grant music, logo or font rights.

This skill does not purchase licenses, transmit media to external services or configure credentials. A network download may occur during `npm ci` and Chromium setup; use approved local binaries/environment overrides when required.

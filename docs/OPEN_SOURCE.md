# Open Source mini challenge: template scaling fix

SteadyUp is built on Amazon's
[react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample).
While building it we found that the template's screen scaling makes layouts
overflow on screens that aren't exactly 16:9, and fixed it. The fix is
contributed back as a pull request.

## The bug

`packages/shared-ui/src/hooks/useScale.ts` scales every size with
`react-native-pixel-perfect`, which uses the ratio of **screen diagonals**. On a
16:9 screen that equals the width ratio, so TVs look right. On anything wider or
taller than 16:9, such as the web build in a browser window or an emulator,
the layout no longer fits. At 1920×993, content ran up to 46px into the footer
on three of SteadyUp's screens, covering hints and pushing text off the screen.

## The fix

Scale by `min(width / 1920, height / 1080)`, so the 16:9 design always fits.
16:9 TVs are unchanged: the scale factor is identical there.

We verified it with SteadyUp's end-to-end test, which walks through every
screen and fails if anything overlaps the footer or runs off the screen:

| Window | Before (diagonal) | After (min) |
|---|---|---|
| 1920×1080 | all screens fit | all screens fit (unchanged) |
| 1920×993 | 4 overflow problems on 3 screens (7–46px) | all screens fit |

## Submitting the pull request

The fix is committed locally on branch `fix/scale-to-fit-16-9` in a clone of
the template. To open the PR:

1. On GitHub, open
   https://github.com/AmazonAppDev/react-native-multi-tv-app-sample and click
   **Fork** (into `Balu-SG`).
2. Push the branch to your fork (Claude can do this once the fork exists):
   ```bash
   git remote add fork https://github.com/Balu-SG/react-native-multi-tv-app-sample.git
   git push fork fix/scale-to-fit-16-9
   ```
3. On GitHub, click **Compare & pull request** and paste the text below.

### Pull request text

**Title:** fix(shared-ui): scale by min(width, height) so 16:9 layouts fit any window

**Description:**

`scaledPixels` uses `react-native-pixel-perfect`, which scales by the ratio of
screen diagonals. On 16:9 screens this equals the width ratio, but on windows
that are wider or taller than 16:9 (the web build in a browser, emulators), the
layout overflows: at 1920×993, content in our app ran up to 46px into the
footer on three screens and pushed text off the bottom.

This change scales by the tighter of `width / 1920` and `height / 1080`, so the
1920×1080 design always fits. 16:9 TVs are unchanged.

Tested with an end-to-end run of every screen in headless Chrome at 1920×1080
(unchanged) and 1920×993 (before: content overflowed the bottom on 3 screens;
after: everything fits).

`react-native-pixel-perfect` is no longer imported; it can be removed from
`apps/vega/package.json` and `apps/expo-multi-tv/package.json` in a follow-up
(left out here to keep the lockfile unchanged).

## Devpost fields for the Open Source mini challenge

- **Contribution URL:** [YOU: the pull request URL once it's open]
- **Repo URL:** https://github.com/AmazonAppDev/react-native-multi-tv-app-sample
- **GitHub username:** Balu-SG
- **What we did, how it works, why it matters:** Fixed the template's screen
  scaling so the 1920×1080 TV layout fits any window. It now scales by
  `min(width/1920, height/1080)` instead of the screen diagonal. This matters
  because the template is Amazon's recommended Fire TV starter, and its web
  build is the fastest way to develop and test. Before the fix, layouts
  overflowed in any browser window that wasn't exactly 16:9, which hides
  buttons and makes UI testing unreliable. 16:9 TVs are unchanged.

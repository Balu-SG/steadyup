# Product feedback and friction log

For the Devpost "Product feedback" field and the optional friction log. Every
entry below is something we hit while building SteadyUp in October 2026, on a
**Fire TV Stick HD (2nd generation)** running **Vega OS 2.0**, with Vega SDK
0.24.12112 and Vega CLI 1.4.4 on macOS. Edit the parts marked **[YOU: …]**
before submitting.

## Product feedback

### Vega SDK and Vega CLI (`vega`, `vda`, `react-native build-kepler`)
- **Used for:** building the SteadyUp TV app for Vega OS (`yarn build:vega`) and
  talking to the device.
- **What worked well:** one command built signed packages for armv7, aarch64
  and x86_64 in a couple of minutes. `vega --help` is clear and well grouped,
  and `vega which vda` made it easy to find the device tool.
- **What needs work:**
  - Old "Kepler" naming is still mixed with "Vega": the build command is
    `build-kepler`, output goes to `build/private/kepler/...`, and the manifest
    refers to `com.amazon.kepler...`. It's hard to tell which docs are current.
  - The build output path contains a literal `undefined` segment:
    `build/private/kepler/@multi-tv/vega/undefined/vega/x86_64/Debug/...`.
  - The debug build is about 2.7 MB and the release about 0.56 MB. It wasn't
    obvious which one to sideload for a demo, or whether debug needs
    Metro running. We couldn't find this quickly in the docs.
- **Would we build with it again?** Yes. Once installed, the app ran smoothly.

### Fire TV device setup for Vega OS (developer mode)
- **Used for:** installing our build on a real Fire TV Stick HD (2nd gen).
- **What worked well:** Developer options appears after the familiar "press 7
  times on About" gesture, and the QR code makes registering the device with a
  developer account quick.
- **What needs work:**
  - Settings → About shows **"OS 2.0 (2602000051520)"**, not "Vega OS". We
    first assumed Fire OS and tried `adb connect`, which failed. A visible OS
    name would save time.
  - Developer options shows **only a QR code**, with no text explaining what
    happens next or how it relates to `vega devmode enable-device --code`.
  - After registering, the device still refused connections on port 5555
    (`vda connect 192.168.1.4` → "Connection refused"), and `vega device list`
    showed "No devices found". There was no on-device "network debugging"
    switch to look for. **[YOU: describe how you finally installed the app,
    e.g. USB cable / Vega app / other.]**
- **Onboarding:** the longest part of the whole project was getting the stick
  ready to accept our build.

### React Native for Vega and the multi-TV template (`react-native-multi-tv-app-sample`)
- **Used for:** the starting point of our TV app: one shared UI package for the
  Vega app, the Expo app (Fire OS / Android TV) and the web.
- **What worked well:** sharing one UI across Vega OS, Fire OS and the web was
  the biggest productivity win. The web target let us run the whole app in
  headless Chrome with a simulated phone, so we could take screenshots and
  check the layout on every screen automatically.
- **What needs work:**
  - The Vega app uses React Native 0.72 and the Expo app uses 0.81, so shared
    code must avoid newer APIs (we avoided `transformOrigin`, SVG and gradients).
    A compatibility table would help.
  - The template scales sizes by the **screen diagonal**
    (`react-native-pixel-perfect`), so on anything that isn't 16:9 (for example
    a browser window) layouts overflow at the bottom. Scaling by
    `min(width/1920, height/1080)` would be safer.
  - `yarn install` printed many peer-dependency warnings, for example
    `@multi-tv/vega doesn't provide @amazon-devices/keplerscript-turbomodule-api`,
    and a failed TypeScript patch hunk.
  - The Vega manifest produced build warnings ("Add an id field to each process
    group").
  - The repo includes a 22 MB demo GIF that most people won't need in their own projects.
- **Would we build with it again?** Yes, it's a strong starter.

### react-tv-space-navigation (focus management)
- **Used for:** D-pad focus on every screen.
- **What worked well:** spatial focus "just worked" for rows of buttons.
- **What needs work:** after the screen content changes, focus can stay on a
  button that is no longer the main action. We had to re-mount the button row
  with a changing `key` so `DefaultFocus` applies again. A documented way to
  move focus programmatically would help.

### Amazon Bedrock (Converse API, Amazon Nova Lite): AWS Builder
- **Used for:** the AI coach. After each session the server sends the results
  to Bedrock and gets back a two-sentence personal message, which the TV shows
  and the phone reads aloud (`server/src/coach.js`).
- **What worked well:** the Converse API is model-agnostic, so swapping models
  only means changing `BEDROCK_MODEL_ID`. The JavaScript SDK supports an abort
  signal, so we can cap the wait at 8 seconds and fall back to a rule-based
  message.
- **What needs work:** **[YOU: fill in after enabling Bedrock, e.g. how model
  access and IAM setup felt, and whether the `us.` inference-profile ID was
  clear.]**

## Friction log

| # | Task attempted | Steps taken | Expected | Actual | Severity | Workaround | Suggestion |
|---|---|---|---|---|---|---|---|
| 1 | Find out which OS the Fire TV Stick HD (2nd gen) runs | Settings → My Fire TV → About | OS name (Fire OS or Vega OS) | "OS 2.0 (2602000051520)" only | Medium | Port scan: adb port closed, so probably Vega | Show "Vega OS 2.0" in About |
| 2 | Enable developer mode on Vega OS | About ×7 → Developer options | A switch, or instructions | Only a QR code with no explanation | Medium | Scanned it and followed the web flow | Add one line of text: "Scan to register this device to your developer account, then …" |
| 3 | Connect to the device over Wi-Fi after registering | `vda connect 192.168.1.4`, `vega device list` | Device listed | "Connection refused" on 5555; "No devices found" | High | **[YOU: what worked]** | Show the connection method and status on the Developer options screen |
| 4 | Use the multi-TV template's web build in a browser window | Ran the web build at 1920×993 and laptop sizes | The 16:9 layout fits | Content overflows into the footer (scaling by diagonal) | Low | We wrapped the app in a scaled 1920×1080 iframe | Scale by `min(w/1920, h/1080)` in the template |
| 5 | Build the Vega package | `yarn build:vega` | Clean build | Output path contains `undefined`; manifest process-group warnings | Low | Ignored | Fix the path and update the template manifest |
| 6 | Share UI code between the Vega app (RN 0.72) and Expo (RN 0.81) | Used one shared-ui package | Same APIs on both | Newer RN APIs unavailable on Vega | Low | Used only basic Views | Publish an RN version / API compatibility table for Vega |

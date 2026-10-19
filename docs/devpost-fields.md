# Devpost fields: SteadyUp

## Step 2: Project overview
- **Project name:** SteadyUp
- **Elevator pitch:** Strength and balance exercises on your TV. The phone in your pocket counts your reps and scores your steadiness. No wearable, no app to install.
- **Thumbnail:** docs/images/thumbnail.png (1200x800, 3:2)

## Step 3: Project details
- **About the project:** paste the whole of docs/devpost-story.md
- **Built with:** react-native, typescript, javascript, node.js, websockets, amazon-bedrock, amazon-nova, amazon-web-services, vega-os, fire-os, fire-tv, web-speech-api, devicemotion, render
- **Try it out links:**
  - https://steadyup.onrender.com/play
  - https://github.com/Balu-SG/steadyup
- **Image gallery (in this order, with captions):**
  1. thumbnail.png: SteadyUp: strength and balance on Fire TV, with the phone in your pocket as the sensor
  2. home.png: Home screen: today's 5-minute session, streak and steadiness trend
  3. pair.png: Pair your phone by scanning a QR code. No app to install
  4. sit-to-stand.png: Sit-to-stand reps counted automatically from the phone in your pocket
  5. balance-hold.png: Balance holds get a live 0–100 steadiness score
  6. summary.png: Session summary with a personal message from the AI coach on Amazon Bedrock
- **Video demo link:** https://youtu.be/3rN6LLTX-Eo

## Step 4: Additional info

- **Upload a file:** leave empty
- **Submitter Type:** Individual
- **Organization Name:** N/A
- **Submitter Country of Residence:** Kuwait
- **Canada province:** N/A
- **Primary Track(s):** Fire TV (only pick the track that SteadyUp actually fits)
- **Code repository URL:** https://github.com/Balu-SG/steadyup
- **Is your project new or existing prior to August 31, 2026?:** New
- **If existing, what you updated:** leave empty

### AWS Builder Mini Challenge
- **Submitting?:** Yes (only if Bedrock is switched on for the live server; otherwise No)
- **Which AWS services and how:**
  SteadyUp uses Amazon Bedrock (Converse API) with Amazon Nova Lite (amazon.nova-lite-v1:0, Sydney region) as an AI coach. When a session ends, the TV app posts the results (sit-to-stand reps, steadiness score per balance hold, trend compared with earlier sessions) to our Node.js server at POST /api/coach. The server cleans the input, turns it into plain lines, and calls Bedrock with a system prompt that asks for two encouraging sentences: one specific win and one practical tip, with no medical advice. The TV shows the reply in a "Your coach" card and the phone reads it aloud with the Web Speech API. To keep it reliable and cheap, the call is capped at 8 seconds with an abort signal, falls back to a rule-based message if Bedrock is slow or unavailable, and is rate-limited to 20 requests per client per 10 minutes. The model ID is set by BEDROCK_MODEL_ID, so another Bedrock model can be swapped in without code changes. Code: server/src/coach.js; documented in the README under "AI coach (Amazon Bedrock)".

### Open Source Mini Challenge
- **Submitting?:** Yes
- **Contribution URL:** https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/137
- **Project Repository URL:** https://github.com/AmazonAppDev/react-native-multi-tv-app-sample
- **GitHub Username:** Balu-SG
- **What, how, why:**
  I fixed the screen scaling in Amazon's react-native-multi-tv-app-sample so the 1920×1080 TV layout fits any window. The template scaled every size with react-native-pixel-perfect, which uses the ratio of screen diagonals. On a 16:9 TV that equals the width ratio, but in any window that isn't exactly 16:9 (the web build in a browser, emulators) the layout overflows: at 1920×993, content ran up to 46px into the footer on three screens and pushed text off the bottom. The fix scales by min(width/1920, height/1080), so the design always fits, and 16:9 TVs are unchanged. I checked it with an end-to-end test that walks through every screen in headless Chrome and fails if anything overlaps the footer or runs off the screen: before the fix, 4 overflow problems on 3 screens at 1920×993; after, everything fits. It matters because this template is Amazon's recommended Fire TV starter and its web build is the fastest way to develop and test, and overflowing layouts hide buttons and make UI testing unreliable.

### Optional
- **Feature Requests:**
  1. Show "Vega OS 2.0" by name in Settings → About on Fire TV. It currently shows only "OS 2.0", so developers try adb and fail. Priority: Important.
  2. Add a line of instructions on the Developer options screen, which today shows only a QR code, plus the device's connection status. Priority: Important.
  3. Publish a React Native version and API compatibility table for Vega (RN 0.72) versus Fire OS / Expo (RN 0.81), for teams that share UI code. Priority: Nice-to-have.
  4. A documented way to move D-pad focus programmatically in react-tv-space-navigation after screen content changes. Priority: Nice-to-have.
- **Friction Log:** https://github.com/Balu-SG/steadyup/blob/main/docs/PRODUCT_FEEDBACK.md
- **Project Testing Link:** https://steadyup.onrender.com/play

### Feedback questions
**Q1. Which developer tools, APIs and SDKs did you use, and for what?**
Vega SDK and Vega CLI to build and install the TV app on a Fire TV Stick running Vega OS. React Native for Vega and Amazon's react-native-multi-tv-app-sample template as the base of one shared UI for Vega OS, Fire OS and the web. react-tv-space-navigation for D-pad focus. Amazon Bedrock (Converse API, Amazon Nova Lite) for the AI coach. In the phone's browser: the devicemotion sensor API for rep counting and balance scoring, the Web Speech API for the spoken coach, and the Web Share API for sharing progress. A Node.js server with WebSockets to pair the TV and phone, hosted on Render.

**Q2. What worked well?**
Vega CLI: one command built signed packages for every architecture in a couple of minutes, and the help is clear. Multi-TV template: sharing one UI across Vega OS, Fire OS and the web was the biggest time saver, and the web target let me run the whole app in headless Chrome with a simulated phone for automated screenshot tests. react-tv-space-navigation: spatial focus worked out of the box for rows of buttons. Bedrock Converse API: model-agnostic, so changing models is a single setting, and abort signals made an 8-second timeout with a fallback easy.

**Q3. What needs work?**
Vega CLI: old "Kepler" names are mixed with "Vega" (build-kepler, build/private/kepler/...), and the build output path contains a literal "undefined" folder. It wasn't clear whether to sideload the debug or release build. Device setup: About shows "OS 2.0" rather than "Vega OS", Developer options shows only a QR code with no explanation, and after registering, vda connect was refused and vega device list showed no devices. Template: Vega uses RN 0.72 and Expo uses RN 0.81, so shared code has to avoid newer APIs (I avoided SVG, gradients and transformOrigin). Scaling by the screen diagonal makes layouts overflow on non-16:9 windows (I fixed this in my open source contribution). There are many peer-dependency warnings on install, and manifest warnings on build.

**Q4. How was your onboarding experience?**
Writing the app was quick thanks to the template: the shared UI was running in a browser on day one. The slowest part of the whole project was getting the Fire TV Stick ready to accept my build: working out that it ran Vega OS rather than Fire OS, understanding the QR-only developer mode screen, and trying to connect to it. I never got a connection, so I switched to the Vega Virtual Device, which also needed a manual fix: the installer had downloaded the simulator image but never unpacked it. Once that was done, the simulator worked well. Clearer on-device text, a "first install on Vega OS" checklist and an installer that checks its own work would cut this from hours to minutes.

**Q5. Would you build with these devices and services again?**
Yes. Once installed, the app ran smoothly on the Vega Virtual Device, and one React Native codebase covering Vega OS, Fire OS and the web is a strong reason to build for Fire TV. Bedrock made adding an AI coach a small, safe change. I'd build again, especially if device setup for Vega OS gets simpler.

### Declarations (tick all three)
- Age of majority: tick
- Eligible jurisdiction: tick
- Not employees of the Promotion Entities: tick

### AI and learning
- **Which AI tools did you use?:** Claude Code (Anthropic), for code generation, debugging, writing tests and drafting documentation. Amazon Nova Lite on Amazon Bedrock runs inside the app as the AI coach.
- **Level of learning:** pick the highest option (for example "Significant": this was my first Fire TV / Vega OS app)
- **Did you gain AI value you can use in your career?:** Yes

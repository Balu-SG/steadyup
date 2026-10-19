## Inspiration

Falls are the leading cause of injury among older adults. Strength and balance exercise is one of the best-proven ways to stay steady, but people stop doing it at home: nobody counts the reps, there's no sign of progress, and exercise apps on a small phone screen are hard to follow. Wearables and cameras cost money and feel intrusive. I wanted to use two things almost every household already has: a TV and a phone.

## What it does

SteadyUp is a guided 5-minute strength and balance routine on Fire TV, built on the moves in the CDC's STEADI tests: the chair stand and the feet together, half-step and heel-to-toe stances, each held for 10 seconds.

- **The TV is the coach.** Large, high-contrast screens readable from the sofa, an animated demo and three tips for every exercise, a safety check before starting, and nothing but the arrows and OK on the remote.
- **The phone is the sensor.** Scan a QR code, tap Start, and put the phone in your front trouser pocket. There's no app to install and nothing to wear.
  - **Sit-to-stand reps are counted automatically** from the angle of the thigh
  - **Balance holds get a live 0–100 steadiness score** from how much the body sways
  - **An impact followed by stillness** brings up an "Are you OK?" prompt on the TV
- **A spoken coach** talks you through each move through the phone's speaker ("Stand up tall, then sit down slowly", rep counts, "Ten seconds left"), so you never have to read the screen mid-exercise.
- **An AI coach on Amazon Bedrock** (Amazon Nova Lite) writes a short personal message about today's results, with one specific win and one tip, and reads it aloud.
- **Progress that brings people back:** day streak, sessions this week and steadiness trend ("79, was 72"), kept privately on the user's phone with no account. A **Share my progress** button sends a summary to family by WhatsApp, SMS or email.

**Why a phone and not a camera?** Most Fire TV sticks have no camera, and many people don't want one pointed at them in their living room. The phone they already own is a private, free motion sensor.

## How I built it

- **TV app:** React Native, from one shared codebase for Fire TV (Vega OS and Fire OS), Android TV and the web, based on Amazon's `react-native-multi-tv-app-sample` template for remote-control focus handling. The exercise demos are animated with plain views (no video files), so they work offline and look the same on every platform.
- **Phone:** a plain web page using the browser's `devicemotion` sensors. All motion processing runs on the phone:
  - a low-pass filter estimates gravity, and the angle against a "seated" reference tells sitting from standing, with hysteresis (stand above 60°, seated below 30°) and a minimum rep time
  - steadiness is the RMS spread of acceleration over the hold, mapped to 0–100
  - a possible fall is an impact above 2.5 g followed by 2 s of stillness
- **Server:** a small Node.js service that pairs the TV and phone with a 4-digit code and QR code, then relays messages over WebSockets.
- **AI coach:** the server calls the Amazon Bedrock Converse API with a cleaned summary of the session. It caps the wait at 8 seconds, falls back to a rule-based message so the coach always answers, and rate-limits requests to control cost.
- **Voice:** the TV sends coaching lines to the phone, which speaks them with the Web Speech API.
- **Testing:** 30 unit tests for pairing, rep counting, steadiness, fall detection and the AI coach, plus an end-to-end test that drives the TV app in headless Chrome with a simulated phone, screenshots every screen, and fails if anything overlaps or runs off a 1080p TV.

## Challenges I ran into

- **Phones sit in pockets at any angle.** Calibrating a "seated" reference at the start of each set made counting work however the phone is oriented.
- **Settling into a stance looks like wobble.** The steadiness score ignores the first 1.5 seconds of each hold.
- **Motion sensors only work on HTTPS pages**, so the server has to be reachable over HTTPS during development as well as in production.
- **One UI on every TV platform.** To make the screens look identical on Vega OS, Fire OS and the web, I avoided SVG and gradients and drew every visual, including the exercise animations, with basic views.

## Accomplishments that I'm proud of

- Rep counting and balance scoring from a phone in a pocket, with no app install and no wearable
- One codebase running on Vega OS, Fire OS and in the browser
- An AI coach that never breaks the session, even when the network or Bedrock is slow

## What I learned

- How much signal a phone's accelerometer gives from a pocket, and how simple filters were enough for this
- Designing for a 10-foot screen and a remote: large type, few choices per screen, everything reachable with arrows and OK
- Building for Vega OS alongside Fire OS from one React Native codebase

## What's next for SteadyUp

- Automatic level-ups as a user's results improve
- Voice control through Alexa ("Alexa, start my SteadyUp session")
- Let the AI coach adapt tomorrow's targets from recent sessions
- Optional weekly summaries for a family member or physiotherapist
- An Amazon Appstore release

_SteadyUp is not a medical device. It encourages exercise and gives feedback; it doesn't diagnose anything or replace an emergency alarm._

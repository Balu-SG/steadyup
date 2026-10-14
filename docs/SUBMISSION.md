# SteadyUp: hackathon submission

## One-liner

Strength and balance exercises on your TV, where the phone in your pocket does
the counting.

## Short description (≈50 words)

SteadyUp is a guided 5-minute strength and balance session for older adults,
shown on the TV and controlled with the remote. A phone in the user's trouser
pocket, running in the browser with no app to install, counts sit-to-stands,
scores balance steadiness live, and asks "Are you OK?" after a sudden fall-like
movement.

## The problem

- Falls are the leading cause of injury among older adults, and fear of falling
  makes people move less, which makes falls more likely.
- Strength and balance exercise is one of the best-proven ways to reduce falls,
  but people stop doing it at home. Nobody counts the reps, there's no sign of
  progress, and phone exercise apps are small and fiddly.
- Wearables and smart cameras cost money, need setting up, and feel intrusive.

## Our solution

SteadyUp uses two devices most households already have:

- **The TV** is the coach: large, high-contrast screens readable from the sofa,
  animated demos and simple tips for every exercise, a safety check before
  starting, and navigation with only the arrows and OK on the remote.
- **The phone** is the sensor. Scan a QR code, tap Start, and put the phone in
  the front trouser pocket. Its motion sensors measure the thigh angle and body
  sway:
  - **sit-to-stand reps** are counted automatically
  - **balance holds** (feet together, half step, heel to toe) get a live 0–100
    steadiness score
  - **an impact followed by stillness** brings up an "Are you OK?" prompt on the TV

At the end, a summary shows reps done and the best steadiness score.

## How we built it

- **TV app:** React Native, from one shared codebase for Fire TV (Vega OS and
  Fire OS), Android TV and the web, with remote-control focus navigation. The
  exercise demos are animated with plain views (no video files), so they run
  offline on every platform.
- **Phone:** a plain web page using the browser's `devicemotion` sensors. Motion
  processing runs on the phone: a gravity low-pass filter, the thigh angle
  against a seated calibration with hysteresis for reps, RMS sway for
  steadiness, and impact plus stillness for fall prompts.
- **Server:** a small Node.js service that pairs the TV and phone with a 4-digit
  code and QR, then relays messages over WebSockets.
- **Testing:** 15 unit tests for pairing and the motion algorithms, plus an
  end-to-end test that drives the TV app with a simulated phone, screenshots
  every screen, and checks that nothing overlaps or runs off a 1080p TV.

## Challenges

- **Phones sit in pockets at any angle.** We calibrate a "seated" reference at
  the start of each set, so counting works however the phone is oriented.
- **Settling into a stance looks like wobble.** We ignore the first 1.5 seconds
  of each hold.
- **Motion sensors need HTTPS** on phones, so the server runs behind an HTTPS
  tunnel.
- **One UI on every TV platform.** To make the screens look the same on Vega
  OS, Fire OS and the web, we avoided SVG and gradients and drew every visual,
  including the exercise animations, with basic views.

## What's next

- Progress history ("steadiness up from 68 to 82 this month") and automatic level-ups
- Spoken cues, so users never have to read the screen mid-exercise
- Optional sharing of the weekly summary with a family member or physiotherapist
- Permanent hosting and an Amazon Appstore release

## Note

SteadyUp is not a medical device. It encourages exercise and gives feedback; it
doesn't diagnose anything or replace an emergency alarm.

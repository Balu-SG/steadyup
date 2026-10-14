# Live demo checklist

The live demo depends on a chain of devices: TV app → tunnel URL → server on the
laptop → phone. Check each link before you present.

## The night before

- [ ] Charge the phone and the laptop. Bring the laptop charger.
- [ ] Download the backup video `out/steadyup-demo.mp4` to the laptop **and**
      the phone, in case Wi-Fi or the tunnel fails.
- [ ] Bring a **sturdy chair without wheels** for the sit-to-stand and balance demo.
- [ ] Wear trousers with a **front pocket** that holds the phone snugly.

## 30 minutes before

1. **Join the venue Wi-Fi** with the laptop, the phone and (if used) the Fire TV.
   Some venue networks block device-to-device traffic. The demo only needs
   internet access, not a local network, because everything goes through the tunnel.
2. **Start the server and tunnel:**
   ```bash
   scripts/dev-tunnel.sh
   ```
   Note the `https://….trycloudflare.com` URL it prints.
3. **The URL has probably changed since the last build.** Rebuild the TV app so
   it points at the new URL:
   - Browser demo: `cd tv/apps/expo-multi-tv && npx expo export -p web --output-dir ../../../out/tv-web`,
     then serve it: `cd out/tv-web && python3 -m http.server 8090`
   - Fire TV (Vega OS): `cd tv && yarn build:vega`, then reinstall the `.vpkg`
4. **Check the server through the tunnel:** open `<tunnel-url>/health` on the
   phone. It should show `{"ok":true,...}`.
5. **Do one full practice run:** pair, 2–3 sit-to-stands, one balance hold.

## Right before you go on

- [ ] Phone: **screen lock off or set to a long timeout**, volume up, Do Not
      Disturb on (a notification mid-demo can pause the browser).
- [ ] Phone browser: the SteadyUp page is open and **Start** has been tapped
      (iPhone asks for motion permission; tap **Allow**).
- [ ] TV / laptop: on the SteadyUp home screen, phone pill shows
      **Phone connected** (green).
- [ ] Laptop: sleep turned off (`caffeinate -d` in a terminal keeps a Mac awake).
- [ ] Backup video open in a player, paused on the first frame.

## Demo script (≈3 minutes)

1. **Problem (20 s):** falls among older adults; exercise helps, but nobody keeps it up at home.
2. **Pair (20 s):** show the QR code, scan it, "no app to install", phone into pocket.
3. **Safety check (10 s):** "We check for a chair and a clear floor every time."
4. **Sit to stand (45 s):** point at the animated demo, press OK, stand up and sit down 3–5 times.
   The count goes up on the TV each time you sit back down.
5. **Balance hold (30 s):** feet together. Wobble on purpose and the steadiness bar drops.
6. **Summary (15 s):** reps and best steadiness.
7. **Close (20 s):** one codebase on Fire TV (Vega OS and Fire OS), Android TV and web; what's next.

To save time, skip the 30-second warm-up with **Skip**, and press **Done** on heel raises.

## If something goes wrong

| Symptom | Fix |
|---|---|
| TV says "Phone not connected" | On the phone, reload the page and tap Start again. Pairing codes stay valid for 3 hours. |
| Reps don't count | Re-seat the phone in the pocket and sit down before pressing OK: the app calibrates "seated" at the start. |
| Nothing works after the tunnel restarted | The URL changed. Rebuild the TV app (step 3 above) or switch to the backup video. |
| Venue Wi-Fi is down | Use a phone hotspot for the laptop and phone, or play the backup video. |

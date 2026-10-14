// Where the SteadyUp server runs. The TV and the phone must reach the same server.
// Production is the Render deploy (render.yaml). For local server changes, run
// `scripts/dev-tunnel.sh`, which points this at a temporary HTTPS tunnel instead;
// set it back to the Render URL before building for a demo.
export const SERVER_URL = 'https://steadyup.onrender.com';

export const RECONNECT_MS = 2000;
export const COUNTDOWN_S = 3;

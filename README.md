# Vi-Activities

Reusable live event activity platform with host controls, QR joining, participant waiting rooms, and live leaderboards.

Current activities:

1. Find the Differences
2. Magic Matrix
3. Fake or Real

## Run

```bash
npm start
```

Open the host screen:

```text
http://localhost:5177
```

For participants, the host screen displays QR codes and direct URLs. Phones must be on the same Wi-Fi as the laptop running the app when running locally.

Default host PIN:

```text
vled_admin
```

## Activity Flow

- Display the host page on the projector.
- Choose one activity card from the landing page.
- Display the full-screen QR code.
- Participants scan the QR, enter their name, tap `Join`, and wait on the waiting screen.
- The host screen shows the joined participant count and names.
- Click `Start Activity` when everyone is ready.
- Participants then see the game, play, and submit.
- The host page switches to the live leaderboard.
- Go back to the landing page to run the next activity.
- Award gifts to the top 3 completed entries.

## Reusing for Any Event

The app is intentionally event-neutral. For a new event, you can reuse the same deployment and only change:

- The activity images in `public/assets/`
- The matrix solution from the host screen
- The host PIN through the `HOST_PIN` environment variable
- Any event-specific instructions you want to announce outside the app

The landing page remains generic as `Vi-Activities`, so the same link can be used across ceremonies, workshops, orientations, seminars, and classroom events.

## Fake or Real

The activity uses 7 images:

- 4 real images from `real2` through `real5`
- 3 latest Gemini-generated fake images

Participants swipe right for Real and left for Fake. The fallback buttons are available for devices where swipe is unreliable. Leaderboard ranking uses score first and completion time as the tie-breaker.

## Magic Matrix Pattern

The host page includes a magic-matrix pattern box. Paste 3 rows with 3 digits each, then click `Use This Solution`.

Example:

```text
816
357
492
```

The puzzle gives 4 cells total and hides the remaining cells. Participants must fill the square so all 3 rows, 3 columns, and 2 diagonals sum to 15.

## Notes

- Leaderboards are stored in memory while the server is running.
- Starting or resetting an activity clears that activity's leaderboard.
- The QR images use a public QR image service. If the internet is unavailable, read the direct URL from the host screen and share it manually.

## Online Hosting

GitHub Pages alone cannot host this full app because the live leaderboard, start button, joined-participant counter, and submissions need a backend server.

Recommended simple options:

- Render Web Service
- Railway
- Fly.io
- A VPS or institute server running Node.js

For online hosting, set the start command to:

```bash
npm start
```

The app already reads `process.env.PORT`, so platforms like Render and Railway can assign the port automatically.

Set this environment variable on Render:

```text
HOST_PIN=vled_admin
```

Participant play pages are public. Host pages and host-control APIs require the PIN.

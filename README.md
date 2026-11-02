# CBIT RideShare

A ride-sharing platform exclusively for CBIT Hyderabad students (`@cbit.ac.in` emails only).

- **Frontend:** React 19, Vite 7, React Router 7, Bootstrap 5, Axios
- **Backend:** Node.js, Express 5, Mongoose 8 (MongoDB Atlas), JWT, bcrypt

```
cbit-rideshare/
├── package.json                   # build + start commands used for deployment
├── render.yaml                    # Render Blueprint (one-click deploy)
├── backend/
│   ├── server.js                  # entry: loads .env, connects MongoDB, starts Express
│   ├── .env.example               # copy to .env
│   ├── scripts/smoke-test.js      # end-to-end verification (npm run smoke)
│   └── src/
│       ├── app.js                 # Express app, CORS, routes, error handler
│       ├── config/env.js          # validates environment variables
│       ├── config/db.js           # MongoDB connection + readable Atlas errors
│       ├── models/                # User, Ride, Booking
│       ├── controllers/           # auth, rides, bookings
│       ├── routes/                # /api/auth, /api/rides, /api/bookings
│       ├── middleware/            # JWT protect, error handler
│       └── utils/                 # validation, AppError, serializers
└── frontend/
    ├── vite.config.js             # proxies /api -> http://localhost:5050
    └── src/
        ├── api/client.js          # Axios instance + every API call
        ├── context/AuthContext.jsx
        ├── components/            # Navbar, RideCard, ErrorBoundary, ...
        └── pages/                 # Home, Login, Register, FindRide, OfferRide, MyRides
```

---

## 1. Prerequisites (macOS)

The only thing to install is **Node.js 22 LTS** (minimum 20.19). You do **not** need to install MongoDB:
the database runs in MongoDB Atlas (cloud).

Either download the macOS installer (.pkg) from https://nodejs.org, or use Homebrew:

```bash
brew install node@22
```

Check it in Terminal:

```bash
node -v
```

## 2. MongoDB Atlas setup (free tier)

1. Sign in at https://cloud.mongodb.com and create a **free M0 cluster** (pick the Mumbai `ap-south-1` region for low latency).
2. **Security → Database Access → Add New Database User**
   - Authentication: Password. Username e.g. `cbitrideshare`.
   - Use a password with **only letters and digits** (otherwise you must URL-encode it: `@`→`%40`, `#`→`%23`, `:`→`%3A`, `/`→`%2F`).
   - Role: *Read and write to any database*.
3. **Security → Network Access → Add IP Address → Add Current IP Address**.
   For development you may use `0.0.0.0/0` (allow from anywhere). Wait until the status is *Active*.
4. **Database → Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://cbitrideshare:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
   and replace `<db_password>` with the database user's password.

The app stores its data in the database `cbit_rideshare` (change with `MONGO_DB_NAME`). Collections `users`, `rides`
and `bookings` are created automatically. View them in Atlas under **Database → Browse Collections**.

## 3. Backend (Terminal window 1)

Unzip the project (double-click `cbit-rideshare.zip`), then in Terminal (adjust the path if you unzipped elsewhere):

```bash
cd ~/Downloads/cbit-rideshare/backend
```

```bash
npm install
```

```bash
cp .env.example .env
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open the env file in TextEdit and set `MONGO_URI` (your Atlas string) and `JWT_SECRET` (the value printed above):

```bash
open -e .env
```

Files starting with a dot are hidden in Finder; press `Cmd + Shift + .` to show them. Save, then start the API:

```bash
npm run dev
```

You should see:

```
[db] Connected to MongoDB host=... db=cbit_rideshare
[api] CBIT RideShare API running at http://localhost:5050/api (development)
```

Check it in the browser: http://localhost:5050/api/health → `{"success":true,"api":"ok","database":"connected"}`

> The backend uses port **5050**, not 5000: on macOS 12+ port 5000 is taken by *AirPlay Receiver*.

## 4. Frontend (Terminal window 2 – `Cmd + T` opens a new tab)

```bash
cd ~/Downloads/cbit-rideshare/frontend
```

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards every `/api/...` request to `http://localhost:5050`, so no
CORS or URL configuration is needed.

## 5. Verify everything (optional, recommended)

With the backend running, in a third Terminal tab:

```bash
cd ~/Downloads/cbit-rideshare/backend
```

```bash
npm run smoke
```

This registers temporary `smoketest.*@cbit.ac.in` users and checks registration/validation, bcrypt hashing, login,
protected routes, ride creation, search filters, join requests, duplicate prevention, owner approval, rejection,
cancellation, seat counts (including simultaneous clicks), ride editing and ride cancellation. It deletes everything
it created at the end and prints `N passed, 0 failed`.

Stop a running server with `Ctrl + C`.

---

## API reference

All routes except register/login/health need `Authorization: Bearer <token>`. Errors always look like
`{ "success": false, "message": "...", "errors": { "field": "..." } }`.

| Method | Path | Who | Description |
|---|---|---|---|
| GET | `/api/health` | anyone | API + database status |
| POST | `/api/auth/register` | anyone | `{ name, email, phone, password, confirmPassword }` |
| POST | `/api/auth/login` | anyone | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | user | current user |
| GET | `/api/rides` | user | upcoming rides with free seats. Query: `q, from, to, date, minSeats, maxCost, sort=soonest\|cheapest\|seats` |
| POST | `/api/rides` | user | `{ from, to, date: "YYYY-MM-DD", time: "HH:mm", seats, totalCost, phone?, notes? }` |
| GET | `/api/rides/mine` | user | rides I offer, each with all its booking requests |
| GET | `/api/rides/:id` | user | one ride |
| PUT | `/api/rides/:id` | owner | edit ride (seats can't go below confirmed passengers) |
| DELETE | `/api/rides/:id` | owner | cancel ride (also cancels its open bookings) |
| POST | `/api/bookings` | user | `{ rideId, message? }` → creates a **pending** booking |
| POST | `/api/rides/:id/join` | user | same as above |
| GET | `/api/bookings/mine` | user | my bookings as a passenger |
| GET | `/api/bookings/requests?status=pending` | owner | requests on my rides |
| PATCH | `/api/bookings/:id/accept` | ride owner | pending → **confirmed**, seats −1 |
| PATCH | `/api/bookings/:id/reject` | ride owner | pending → **rejected**, seats unchanged |
| PATCH | `/api/bookings/:id/cancel` | passenger | pending/confirmed → **cancelled**; confirmed restores 1 seat |

### Booking rules

- `Ride.seats` = seats offered; `Ride.availableSeats` = seats still free.
- Accept: the booking is atomically moved `pending → confirmed` first, then one seat is taken with a
  conditional `$inc` that only succeeds while `availableSeats > 0`. If no seat is left the booking is put
  back to `pending`. A double-click can never take two seats, and a ride can never be overbooked.
- Cancel: the booking is atomically moved to `cancelled`; only the request that changed a **confirmed**
  booking restores the seat, so seats are restored exactly once.
- Duplicates: one pending/confirmed booking per passenger per ride, enforced in code **and** by a
  partial unique index in MongoDB. After a rejection the passenger can't re-request that ride; after
  cancelling they can.
- Owners can't join their own rides; full, cancelled and departed rides can't be joined.
- The owner's phone number is only shown to the owner and to confirmed passengers.

---

## Troubleshooting

| Message in the backend terminal | Fix |
|---|---|
| `Missing required environment variable(s)` | `backend/.env` doesn't exist or is empty. Run `cp .env.example .env` inside `backend` and fill it in. |
| `bad auth : authentication failed` | Wrong database user/password (not your Atlas login). URL-encode special characters. |
| `querySrv ECONNREFUSED` / `ENOTFOUND` | Your DNS blocks SRV lookups. Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env`, or use a mobile hotspot. |
| `Server selection timed out` | Your IP isn't in Atlas Network Access, the cluster is paused, or the network blocks port 27017 (common on college Wi-Fi; try a hotspot). |
| `Port 5050 is already in use` | Find the process with `lsof -i :5050`, or set `PORT=5051` in `backend/.env` and `VITE_API_PROXY_TARGET=http://localhost:5051` in `frontend/.env` (`cp .env.example .env` in `frontend`). |
| `npm: command not found` | Node.js isn't installed or Terminal was open during install – reinstall Node and open a new Terminal window. |
| `EACCES` permission errors during `npm install` | Never use `sudo npm install` inside the project. If you used it once, run `sudo chown -R $(whoami) ~/.npm` and delete the project's `node_modules` folder, then `npm install` again. |

| Message in the browser | Fix |
|---|---|
| `Backend unavailable (HTTP 500). Start it with: cd backend; npm run dev` | The Express server isn't running or crashed – check its Terminal tab. |
| `Your session has expired. Please log in again.` | Token expired or `JWT_SECRET` changed. Log in again. |
| Page shows "This page failed to load" | A React component crashed – the message and stack trace are shown on the page and in the browser console (`Cmd + Option + I` in Chrome). |

### Optional: local MongoDB instead of Atlas

Only needed if Atlas can't be reached from your network. With Homebrew:

```bash
brew tap mongodb/brew
```

```bash
brew install mongodb-community
```

```bash
brew services start mongodb-community
```

Then set `MONGO_URI=mongodb://127.0.0.1:27017` in `backend/.env`. No code changes are needed.

## Deployment (free): Render + MongoDB Atlas

The whole app deploys as **one Render web service**: Express serves the API under `/api` and the built React app
for every other URL, so there is one link, no CORS setup and no `VITE_API_URL`. The database stays on Atlas.

### Step 1 – Put the project on GitHub (Mac Terminal)

Create an **empty** repository at https://github.com/new (e.g. `cbit-rideshare`, no README). Then:

```bash
cd ~/Downloads/cbit-rideshare
```

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "CBIT RideShare"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/cbit-rideshare.git
```

```bash
git push -u origin main
```

`.env` files and `node_modules` are excluded by `.gitignore`, so your secrets are **not** uploaded. Check on GitHub
that no `.env` file appears.

### Step 2 – Allow Render to reach Atlas

Render's free servers don't have fixed IP addresses, so in **Atlas → Security → Network Access → Add IP Address**
choose **Allow access from anywhere** (`0.0.0.0/0`). Your database is still protected by the database user's
password – use a long random one.

### Step 3 – Create the service on Render

1. Sign up at https://render.com with your GitHub account.
2. **New → Blueprint** → select your `cbit-rideshare` repository. Render reads `render.yaml`.
3. When asked for `MONGO_URI`, paste your Atlas connection string. `JWT_SECRET` is generated automatically.
4. Click **Apply**. The first build takes 2–4 minutes.

(Without the Blueprint: **New → Web Service** → your repo → Build command `npm run build`, Start command
`npm start`, Instance type *Free*, and add environment variables `NODE_ENV=production`, `NODE_VERSION=22`,
`MONGO_URI=...`, `JWT_SECRET=...` (a new random 64+ character value).)

### Step 4 – Check it

- `https://YOUR-SERVICE.onrender.com/api/health` → `{"success":true,"api":"ok","database":"connected"}`
- `https://YOUR-SERVICE.onrender.com` → the CBIT RideShare home page. Register, offer a ride, join from a second account.

Every `git push` to `main` redeploys automatically.

### Good to know

- **Free tier sleeps** after 15 minutes without visitors; the next visit takes ~50 seconds to wake up. A paid instance
  (or a different host) avoids this.
- **Logs:** Render dashboard → your service → *Logs*. The same readable `[db]` / `[api]` messages appear there.
- **Database errors on Render** (`bad auth`, `Server selection timed out`): fix `MONGO_URI` under *Environment*, or the
  Atlas Network Access entry, then *Manual Deploy → Deploy latest commit*.
- **Own domain:** Render → *Settings → Custom Domains*.
- **Hosting the frontend elsewhere** (e.g. Vercel/Netlify): build it with `VITE_API_URL=https://YOUR-SERVICE.onrender.com/api`
  and add the frontend's URL to `CLIENT_ORIGIN` on Render.

### Run the production build locally (optional)

```bash
cd ~/Downloads/cbit-rideshare
```

```bash
npm run build
```

```bash
NODE_ENV=production npm start
```

Then open http://localhost:5050 – one server, exactly as on Render.

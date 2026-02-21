# RakshaSetu — Citizen App

Emergency disaster reporting & real-time incident tracking app built with **Expo SDK 54** + **React Native**.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router v6 (file-based) |
| State | React Context + AsyncStorage |
| Real-time | WebSocket (native) |
| Maps | react-native-maps |
| HTTP | fetch / axios |
| Auth | JWT + OTP (phone-based) |

## Setup

```bash
cd packages/citizen-app
npm install
npx expo start
```

> **⚠️ API URL:** In `config.ts`, set your **local machine IP** (run `ipconfig`), NOT `localhost` — mobile devices can't reach localhost on your PC.

## Backend API (user-be @ port 5001)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/otp/request` | POST | ✗ | Send OTP to phone |
| `/auth/otp/verify` | POST | ✗ | Verify OTP → JWT |
| `/auth/signup` | POST | ✗ | Create account |
| `/auth/login` | POST | ✗ | Email/password login |
| `/users/me` | GET | ✓ | Get current user |
| `/users/me` | PATCH | ✓ | Update profile |
| `/sos` | POST | ✓ | Submit SOS report |
| `/sos/my` | GET | ✓ | My SOS reports |
| `/sos/upload-url` | GET | ✓ | Get presigned R2 URL |
| `/sos/:id/media` | POST | ✓ | Attach media to report |
| `/incidents` | GET | ✓ | List incidents |
| `/incidents/:id` | GET | ✓ | Incident detail |
| `/incidents/:id/timeline` | GET | ✓ | Status event history |
| WebSocket `/ws` | — | — | Real-time alerts |

## Screens (13 total)

### Auth Flow
1. **Welcome** — Onboarding splash
2. **Phone OTP Login** — Enter phone → verify 6-digit OTP
3. **Signup** — Name, email, password (first-time users)

### Main Tabs
4. **Home / Map** — Map with nearby incidents + SOS button
5. **My Reports** — User's SOS report history
6. **Alerts Feed** — Real-time incident alerts via WebSocket
7. **Profile** — User info, edit, logout

### SOS Flow
8. **SOS Report** — Category, description, auto-location
9. **Media Upload** — Camera/gallery → R2 upload
10. **Confirmation** — Report submitted with tracking ID

### Detail Screens
11. **Incident Detail** — Full incident info + map
12. **Incident Timeline** — Status update history
13. **Report Detail** — User's report with media

## File Structure

```
app/
├── _layout.tsx              # Root layout (auth guard)
├── (auth)/
│   ├── _layout.tsx
│   ├── welcome.tsx          # Onboarding
│   ├── phone-login.tsx      # OTP login
│   └── signup.tsx           # Registration
├── (tabs)/
│   ├── _layout.tsx          # Tab bar
│   ├── index.tsx            # Home/Map
│   ├── my-reports.tsx       # Reports list
│   ├── alerts.tsx           # Real-time feed
│   └── profile.tsx          # User profile
├── sos/
│   ├── report.tsx           # SOS form
│   ├── media.tsx            # Media upload
│   └── confirmation.tsx     # Success screen
├── incidents/
│   ├── [id].tsx             # Incident detail
│   └── [id]/timeline.tsx    # Timeline
└── reports/
    └── [id].tsx             # Report detail
```

## SOS Categories

`FLOOD` · `FIRE` · `EARTHQUAKE` · `ACCIDENT` · `MEDICAL` · `VIOLENCE` · `LANDSLIDE` · `CYCLONE` · `OTHER`

## Environment

Backend environment is configured in `packages/user-be/.env`:
- ✅ Database (Neon PostgreSQL)
- ✅ JWT Auth
- ✅ Kafka (Docker)
- ✅ SMS (MSG91)
- ✅ R2 Media Storage (Cloudflare bucket created)
- ⏳ Push Notifications (Expo token needed)

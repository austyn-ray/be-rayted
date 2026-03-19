# Be Rayted 🎤

> Come to be rated or be berated.

A real-time comedy open mic voting app built with Next.js and Supabase.

## Setup

1. Clone this repo
2. Run `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials
4. Run `npm run dev` to test locally
5. Deploy to Vercel

## Pages

- `/` — Audience voting page (this is what the QR code points to)
- `/host` — Host dashboard (for your eyes only!)

## How It Works

1. Add comics to the lineup on the host dashboard before the show
2. Print the QR code pointing to your app's `/` URL and put it on tables
3. After each comic's set, tap "Open Voting" on the host dashboard
4. Audience votes in real time — no page refresh needed
5. Close voting when ready for the next comic
6. Winner is shown at the top of the host dashboard all night

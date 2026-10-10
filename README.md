# Search Mirror — Next.js + Supabase + Vercel

A custom search-style page whose text is broadcast live to other devices opening the same path. The controller's **Go** button redirects only the controller device. This is an independent demo interface, not Google's product or official UI.

## 1. Create Supabase project
1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the Project URL and the publishable/anon key.
3. No SQL tables are needed: this demo uses Supabase Realtime Broadcast.

## 2. Run locally
1. Install Node.js LTS from https://nodejs.org.
2. Extract this ZIP and open a terminal in the project folder.
3. Copy `.env.example` to `.env.local`.
4. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Run:
   ```bash
   npm install
   npm run dev
   ```
6. Open http://localhost:3000/2?control=1 on your controller device.
7. Open http://localhost:3000/2 on another device on the same network. For phone testing, deploy to Vercel or use a secure tunnel; localhost on a phone refers to the phone itself.

## 3. Deploy to Vercel
1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project**, import the repository.
3. Add the two environment variables from `.env.local` in Vercel Project Settings → Environment Variables.
4. Deploy. If you add/change env vars later, redeploy.
5. Add your custom domain in Vercel if desired.

## 4. Test
- Controller: `https://YOUR-DOMAIN/2?control=1`
- Viewer: `https://YOUR-DOMAIN/2`
- Use the same path on both devices (`/2`, `/3`, etc. are separate rooms).
- Typing on controller broadcasts text to viewers connected to that room.
- The Go button validates the destination and redirects the controller device only. Viewers can see the shared text; they are not forced to navigate away.

## Important limitations
- Broadcast is real-time only: a viewer who joins later may not receive previous text until the controller types again or presses **Sync now**.
- This is a demo with a public room name. Anyone who knows the URL can potentially join and broadcast into that room. Do not use it for confidential information. Add authentication and server-side authorization before production use.
- The `?control=1` flag is a convenience, not secure authentication. Do not rely on it to protect sensitive actions.
- A Supabase Realtime connection and network access are required.

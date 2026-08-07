# THIRTEEN (https://thirteen-jpfq.onrender.com)

A real-time multiplayer implementation of the classic card game "13," playable with 2–7 players in the same lobby.

---

## Project Setup

**Framework & Language**
- [Next.js](https://nextjs.org/) (App Router) with [TypeScript](https://www.typescriptlang.org/)
- Custom Node server (`server.ts`) wrapping Next.js, since the app needs a persistent process for real-time features

**Real-Time Communication**
- [Socket.IO](https://socket.io/) for live gameplay — turn tracking, card draws/discards, group arrangement syncing, lobby updates, and round/game-end broadcasts all happen over WebSocket connections rather than page reloads or polling.

**Authentication**
- [Auth.js (NextAuth) v5](https://authjs.dev/) using a JWT session strategy
- Credentials-based sign-in for registered accounts (hashed passwords via bcrypt)
- A separate lightweight guest sign-in flow for players who want to join without creating an account

**Database & ORM**
- [PostgreSQL](https://www.postgresql.org/), hosted on [Neon](https://neon.tech/)
- [Prisma](https://www.prisma.io/) as the ORM, handling schema, migrations, and typed queries

**UI**
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/) primitives for accessible components
- [dnd-kit](https://dndkit.com/) for drag-and-drop card arrangement
- [Framer Motion](https://www.framer.com/motion/) for animations (card movement, overlays, transitions)
- [Zustand](https://zustand-demo.pmnd.rs/) for client-side state management

**Hosting**
- Deployed on [Render](https://render.com/) as a persistent web service (required for the always-on Socket.IO connection)
- Database hosted separately on Neon
- Scheduled maintenance tasks (guest account cleanup) run via a GitHub Actions cron workflow, hitting a protected internal API route on a set interval

---

## Account Creation & User Flow

**Registered Users**
1. A new player signs up with a name, email, and password from the registration page.
2. Passwords are hashed before being stored — the app never keeps a plaintext password anywhere.
3. Once signed in, registered users get a persistent account tied to their email. This unlocks:
   - A personal dashboard showing recent games
   - Full lifetime statistics: games played, games won, win percentage, average score, best/worst single-game score, current and longest win streaks
   - Match history — a running log of past games, final scores, and placement
4. Registered accounts persist indefinitely and can sign in from any device.

**Guest Users**
1. From the login screen, a player can choose "Continue as Guest" instead of signing in.
2. The app generates a temporary display name (e.g. `Guest1234`) and a lightweight account behind the scenes — enough to join lobbies and play, nothing more.
3. Guests can create or join lobbies and play full games alongside registered users, with identical gameplay rules and scoring.
4. Guests do **not** have persistent statistics or match history — there's no dashboard or stats page for a guest account, since there's nothing meant to be saved long-term.
5. Guest accounts are automatically cleaned up from the database after 24 hours via a scheduled background job, so no guest identity lingers indefinitely.

**Sign Out**
- Both registered users and guests sign out through the same control, which ends the active session and returns to the landing page. For guests, signing out effectively ends that identity for good — there's no way to "log back in" as the same guest, since none of their state was ever meant to be recovered.

---

## How the Game Is Played

Card 13 is a rummy-style card game played with **two standard 52-card decks shuffled together** (104 cards total), across **11 rounds**, for **2 to 7 players**.

### The Rounds

Each round deals more cards than the last, and each round has its own **wild rank**:

| Round | Cards Dealt | Wild Rank |
|-------|-------------|-----------|
| 1     | 3           | 3s        |
| 2     | 4           | 4s        |
| 3     | 5           | 5s        |
| 4     | 6           | 6s        |
| 5     | 7           | 7s        |
| 6     | 8           | 8s        |
| 7     | 9           | 9s        |
| 8     | 10          | 10s       |
| 9     | 11          | Jacks     |
| 10    | 12          | Queens    |
| 11    | 13          | Kings     |

A wild card can stand in for any rank needed to complete a set or run.

### On Your Turn

1. **Draw** one card — either from the top of the face-down draw pile, or the top of the face-up discard pile.
2. **Arrange** your hand — organize cards into valid groups (sets or runs) to reduce your score. Groups are visible only to you.
3. **Discard** one card to the discard pile, ending your turn.

### Valid Groups

- **Set**: three or more cards of the same rank (e.g. 7-7-7). Wild cards can fill in for a missing card.
- **Run**: three or more cards of consecutive rank, in order (e.g. 5-6-7). Suit does not matter — a run can mix suits freely. Wild cards can fill gaps within a run.
- **Ace rules**: Ace can be the low end of a run (A-2-3) or the high end (Q-K-A), but cannot wrap around (K-A-2 is not valid).
- Order matters for scoring purposes — cards in a group must actually be arranged in the correct ascending sequence for a run to count; simply holding the right three cards out of order does not.

### Knocking

Once a player has arranged their **entire hand** into valid groups — no cards left over, every group correctly formed — they may **knock**. Knocking signals that the round is about to end.

After a knock:
- Every other player gets exactly one more turn to do the best they can with their hand.
- Any cards those players haven't successfully grouped by the time their final turn ends count against them at face value.

### Scoring

At the end of a round, each player's hand is scored:
- Cards inside a valid, correctly-ordered group score **0 points**.
- Any other cards — ungrouped, or sitting in an invalid group — score their face value:
  - Number cards (2–10): worth their printed number
  - Ace: worth 1 point
  - Jack, Queen, King: worth 10 points each

Scores accumulate across all 11 rounds. After the final round, the player with the **lowest total score** wins.

### Live Feedback During Play

- A running score tracker shows what your current hand arrangement would score if the round ended right now — encouraging players to keep refining their groups before discarding.
- Group summaries remain visible in a compact form even outside of active editing, so players always have a quick reference to what they've already built.
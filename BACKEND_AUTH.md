# Backend, Database & Authentication System Technical Documentation

This document describes the design, implementation, and portability of the backend database, authentication, session persistence, and data migration flows in CompGraph.

---

## 🏛️ Architecture Overview

CompGraph is powered by a standard client-server model:
1. **Frontend**: React 19 + Vite 8 client dashboard. Handles visual charts, user settings toggles, CSV generation, and file uploads.
2. **Backend**: Node.js + Express.js API server. Handles relational persistence, authentication sessions, and secure bulk uploads.
3. **Database**: SQLite (local single-file database) accessed via **Prisma ORM**.
4. **Proxy**: Vite is configured during development to proxy `/api` routes directly to the Express server running on port 5000.

---

## 🔒 Cryptographic Password Verification (Double Hashing)

To guarantee maximum user credential security and prevent plain-text password exposure during transit, CompGraph implements a **Double Hashing** strategy:

1. **Frontend Hashing (SHA-256)**:
   * When a user inputs their password, the client-side React code immediately computes an irreversible cryptographic SHA-256 digest natively in the browser (via `crypto.subtle.digest`).
   * **Result**: Plaintext passwords are **never** transmitted over the network. To verify this, the network payload parameters are renamed to `passwordHash` so that the word `password` (which would represent raw text) does not appear in request payloads in the browser's Network tab. Only the SHA-256 hex fingerprint is sent.

2. **Backend Hashing (bcryptjs)**:
   * The Express backend receives the `passwordHash` transit fingerprint. Instead of storing it directly (which would make it susceptible to replay attacks if leaked), it hashes this value a second time using `bcryptjs` with a work factor (salt rounds) of `10`.
   * **Database Storage**: The database only saves the result of the secondary hash:
     $$\text{Stored Digest} = \text{bcrypt}\Big(\text{passwordHash}, \text{salt}\Big) = \text{bcrypt}\Big(\text{SHA-256}(\text{plaintext}), \text{salt}\Big)$$

3. **Authentication Verification**:
   * During login, the server retrieves this stored double-hashed digest.
   * It runs `bcrypt.compare` to verify the incoming client `passwordHash` against the saved database fingerprint, securely confirming credentials without ever knowing the plaintext password.

---

## 🕵️ Information Disclosure & Leakage: What Can Be Revealed?

In the event of a security compromise, it is crucial to understand exactly what information can be revealed to an attacker and what remains fully protected:

### 1. In-Transit Compromise (Man-in-the-Middle / Network Eavesdropping)
* **What is Protected**: The user's **original plaintext password is fully protected** from disclosure. Because only the SHA-256 fingerprint is sent as `passwordHash` over the wire, an attacker sniffing the network traffic cannot recover the raw password. This protects the user from credential harvesting (e.g. if they reuse their plaintext password on other web sites).
* **What Can Be Revealed**: Without TLS/HTTPS, the **transit hash (`passwordHash`) can be intercepted**. Because the backend verifies this hash directly, an attacker who intercepts the `passwordHash` can replay it to authenticate as the user (replay attack). *Mitigation: Production deployments must enforce SSL/TLS (HTTPS).*

### 2. Database Leak (Database Compromise)
* **What is Protected**: 
  * The **plaintext password remains fully protected**.
  * The **transit SHA-256 hash (`passwordHash`) remains fully protected**. Because the database only stores the bcrypt-hashed representation of the transit hash, a compromised database does **not** allow an attacker to obtain the SHA-256 hash to log in via replay attacks.
  * Attacking the stored digests using precomputed dictionary attacks (rainbow tables) is impossible because bcrypt applies unique random salts to every record.
* **What Can Be Revealed**: An attacker with a copy of the database gets the user's username, name, salary events, compensation events, and preferences. They also get the bcrypt hash, which they could try to brute-force offline. However, due to bcrypt's work factor, this is computationally expensive.

### 3. Active Session Compromise (Client-Side Storage Leak / XSS / Device Theft)
* **What is Protected**: The plaintext password and the transit SHA-256 hash are never stored on the client.
* **What Can Be Revealed**: If an attacker gains access to the client machine or exploits a Cross-Site Scripting (XSS) vulnerability, they can read the **JWT token (`comp_graph_token`)** and settings from `localStorage`. This allows them to impersonate the user and read/write their progression data for the duration of the 30-day session lifetime.


---

## 🎟️ Session Persistence (30-Day Expiry)

Authentication state persists across browser reloads for exactly **one month (30 days)**:
1. **Token Generation**: Upon successful login or signup, the backend generates a JSON Web Token (JWT) signed using a secure server-side key (`JWT_SECRET`).
   * The token payload contains `{ userId: user.id }`.
   * The token expiration is set to `{ expiresIn: '30d' }`.
2. **Storage**: The token is returned to the client and saved in `localStorage` under the key `comp_graph_token`.
3. **API Authorization**:
   * All CRUD requests include the header `Authorization: Bearer <token>`.
   * The backend `verifyToken` middleware parses this header, validates the signature, and rejects expired/tampered tokens with a `401 Unauthorized` status.
4. **Auto-Logout on Expiry**: If a token has expired, the client API wrapper automatically removes the token/user from storage, dispatches an `auth-expired` event, and redirects the user back to the login screen.

---

## 💱 SQLite to PostgreSQL Portability Guide

Prisma ORM makes switching databases extremely simple. To migrate CompGraph from SQLite to PostgreSQL:

1. **Update Prisma Schema**:
   Open `backend/prisma/schema.prisma` and edit the `db` block:
   ```prisma
   // Replace this:
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }

   // With this:
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Configure Database Connection String**:
   Open `backend/.env` (and your root `.env` file) and replace the SQLite URL with your PostgreSQL connection URL:
   ```env
   # Replace this:
   DATABASE_URL="file:./dev.db"

   # With this:
   DATABASE_URL="postgresql://db_user:db_password@localhost:5432/comp_graph_db?schema=public"
   ```

3. **Re-generate Prisma Client & Run Migrations**:
   Execute the following commands in your terminal:
   ```bash
   # Push schema changes to Postgres database
   npx prisma db push --schema=backend/prisma/schema.prisma
   ```

No code changes are required in the Express server or React code as the Prisma client queries remain identical.

---

## 📑 API Endpoints Summary

### Authentication Routes
* `POST /api/auth/signup`: Create a new user profile.
* `POST /api/auth/login`: Authenticate credentials and get a 30-day JWT.
* `GET /api/auth/profile`: Get current user settings (Protected).
* `PUT /api/auth/settings`: Update user settings (Theme, currency, start month) (Protected).

### Event CRUD Routes (All Protected)
* `GET /api/events`: Fetch all salary and comp events for the active user.
* `POST /api/events/sync`: Overwrite entire timeline history (used for CSV/JSON imports).
* `POST /api/events/salary`: Add a new salary change milestone.
* `PUT /api/events/salary/:id`: Edit a salary change milestone.
* `DELETE /api/events/salary/:id`: Delete a salary change milestone.
* `POST /api/events/comp`: Add a new discrete payout (bonus/equity).
* `PUT /api/events/comp/:id`: Edit a discrete payout.
* `DELETE /api/events/comp/:id`: Delete a discrete payout.

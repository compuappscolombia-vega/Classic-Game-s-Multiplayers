# Security Specification & Hardening Audit

## 1. Data Invariants
1. **Identity Integrity**: Every document under `/users/{userId}`, `/users/{userId}/private/{docId}`, `/users/{userId}/matches/{matchId}`, and `/leaderboard/{entryId}` must have `uid == request.auth.uid` and path parameter matching `request.auth.uid` (for user-scoped paths) or `entryId == request.auth.uid`.
2. **PII Isolation**: Email addresses and provider identifiers reside strictly in `/users/{userId}/private/info` which permits read/write exclusively to `request.auth.uid == userId`.
3. **Immutable Ownership & Creation Time**: `uid`, `provider`, and `createdAt` cannot be modified after document creation.
4. **Server Timestamps**: `createdAt` (on create) and `updatedAt` (on create/update) must equal `request.time`.
5. **Bounded Progression & Anti-Cheat**: `elo` is bounded `[0, 10000]`, single-update `elo` delta is bounded `[-100, +100]` on update, and `totalWins <= totalGames`.
6. **Verified Accounts**: All write operations require `request.auth.token.email_verified == true`.
7. **Relational Atomicity**: Creating a `/leaderboard/{entryId}` entry requires `existsAfter(/databases/$(database)/documents/users/$(request.auth.uid))`.

## 2. Dirty Dozen Adversarial Payloads
1. **Unauthenticated Leaderboard Read**: `list /leaderboard` without auth -> `PERMISSION_DENIED`.
2. **Identity Spoofing on User Create**: `create /users/victimUid` with `uid: "victimUid"` by `attackerUid` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: `create /users/uid` with extra `isAdmin: true` field -> `PERMISSION_DENIED` via `hasOnly`.
4. **Unverified Email Write**: `create /users/uid` with `email_verified: false` -> `PERMISSION_DENIED`.
5. **PII Snooping**: `get /users/victimUid/private/info` by `attackerUid` -> `PERMISSION_DENIED`.
6. **PII Enumeration**: `list /users` by any user -> `PERMISSION_DENIED` (`allow list: if false`).
7. **ELO Inflation Attack**: `update /leaderboard/uid` setting `elo: 99999` or jumping `+500` in one update -> `PERMISSION_DENIED`.
8. **Win Count Exceeds Games**: `update /users/uid` with `totalWins: 50, totalGames: 10` -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: `get /leaderboard/invalid$id!with#badchars` -> `PERMISSION_DENIED` via `isValidId`.
10. **Client Timestamp Forgery**: `create /users/uid/matches/m1` with backdated `createdAt` != `request.time` -> `PERMISSION_DENIED`.
11. **Immutable Field Mutation**: `update /users/uid` attempting to alter `createdAt` or `provider` -> `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: `list /users/victimUid/matches` by `attackerUid` -> `PERMISSION_DENIED` via `resource.data.uid == request.auth.uid`.

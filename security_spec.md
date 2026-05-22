# Security Specification for LostLink

## Data Invariants
1. A report must have a valid title (min 3 chars).
2. `reporterId` must match the authenticated `request.auth.uid`.
3. `type` must be either 'lost' or 'found'.
4. `status` must be 'active' initially.
5. `createdAt` must be set via server timestamp (or validated number).

## The Dirty Dozen (Attacker Payloads)
1. **Identity Spoofing**: `reporterId` set to a different user's UID.
2. **Ghost Field Injection**: Adding `isVerified: true` to an item.
3. **Malicious ID**: Using a very long or special-character string as document ID.
4. **Invalid Type**: Setting `type` to 'reward-claimed'.
5. **PII Leak**: Attempting to read a user's private data (if we had a users collection).
6. **State Skip**: Updating status directly to 'resolved' by someone other than the owner.
7. **Resource Poisoning**: Injection of 1MB string into 'title'.
8. **Unauthenticated Write**: Posting an item without being logged in.
9. **Arbitrary Update**: Modifying `createdAt` during an update.
10. **Global Delete**: Authenticated user attempting to delete someone else's post.
11. **Negative Date**: Setting `date` to a distant future or garbage string.
12. **Blanket Read**: Querying for all items without restrictions (if they were private).

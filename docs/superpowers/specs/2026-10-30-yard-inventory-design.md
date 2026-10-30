# Yard Inventory — Design Spec (2026-10-30)

## Purpose
Track finished cars at external storage yards via QR (chassis number) scan IN/OUT, with stock take, admin reporting, and a TV stock dashboard.

## Stack
- Vite + React + TypeScript PWA
- Firebase Hosting (static app)
- Cloud Firestore (data)
- Firebase Auth (admin email/password)
- Admin PIN (hashed) for stock-take confirm / sensitive ops
- GitHub repo for source control

## Auth model
- Yard scan / stock-take counting: staff number only (no login)
- Admin screens: Firebase Auth + optional PIN for confirmations
- Dashboard TV URL: no login (internal use)

## Inventory rules
- Unit location stored on `units/{chassisNo}.yardId`
- All movements append to `transactions` (audit log)
- Duplicate IN same yard: reject
- IN while at another yard: confirm → `TRANSFER`
- OUT when not IN this yard: confirm allowed
- Offline: IndexedDB queue, sync FIFO with `clientEventId` dedupe

## Stock take
- Snapshot expected chassis at session start
- Multi-phone join same open session
- IN/OUT remain allowed; mid-count moved/arrived highlighted
- Hybrid review: supervisor confirms per line; adjustments written only on confirm

## Admin
- Excel-like grids for transactions, units, yards, stock-take sessions
- Search/filter on key tables
- CSV export current table + export all tables

## Out of scope (v1)
Staff master/roles, Cloud Functions validation, ERP sync, photo evidence

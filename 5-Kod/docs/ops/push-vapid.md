# Web Push / VAPID — operatörssteg (plan 015)

Push är byggd end-to-end men **sover tills VAPID-nycklarna sätts**. Utan dem:
PushOptIn renderar inget, send-push svarar 503, routern väljer e-post/SMS.

## 1. Generera nyckelpar (en gång)

```bash
npx web-push generate-vapid-keys
```

Ger `Public Key` + `Private Key`. **Privatnyckeln committas ALDRIG.**

## 2. Sätt secrets för edge-funktionen

```bash
cd 5-Kod
npx supabase secrets set VAPID_PUBLIC_KEY="<public>" VAPID_PRIVATE_KEY="<privat>" VAPID_SUBJECT="mailto:booking@corevo.se"
npx supabase functions deploy send-push
```

## 3. Exponera publika nyckeln till klienten (build-tid)

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` måste finnas vid **bygget** (OpenNext inlinar
NEXT_PUBLIC_*). Lägg den i deploy-workflowens build-env (GitHub Actions variabel
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) — publika nyckeln är just publik, ingen secret.

## 4. Verifiera

1. Logga in som kund på en tenant-sajt → /konto → kortet "Få notiser om dina
   bokningar" syns (Chrome/Android; iOS kräver PWA på hemskärmen).
2. Aktivera → rad i `push_subscriptions`, `customer_notification_prefs.push_enabled=true`.
3. Boka en tid som den kunden → bekräftelsen går som push (outbox-raden visar
   `chosen_channel=push`, `cost_ore=0`); utan sub → e-post som förr.
4. Avinstallera/återkalla → nästa sändning revocar raden (`revoked_at` satt).

## Begränsningar

- iOS: push kräver att PWA:n är tillagd på hemskärmen (Apple-regel). Tvinga
  aldrig — e-post/SMS-fallbacken (plan 014-routern) bär de kunderna.
- SW:n (`public/kund-sw.js`) är avsiktligt mager: bara push + klick, ingen cache.

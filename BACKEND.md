# Giving the world one shared memory

Without this, every letter, wish and memory lives in the browser that wrote
it. Aravind's laptop and Aravind's phone are two different worlds, and Diana
never sees either. This is what joins them.

It costs nothing: Firestore's free tier is far beyond anything two people
writing letters will ever use.

---

## 1. Make the project (5 minutes, and only you can do it)

1. Go to <https://console.firebase.google.com> and sign in with a Google
   account.
2. **Add project** → call it anything → you can turn Google Analytics **off**.
3. In the left sidebar: **Databases & Storage → Firestore → Create database**.
   Pick a location near you — it cannot be changed afterwards. Start in
   **production mode**, which denies every read and write until you publish
   the rules in step 3 below. Do not pick test mode: that one is open to
   anybody for 30 days.
4. In the left sidebar: **Security → Authentication → Get started**, then the
   **Sign-in method** tab.
   - For the **link** model, enable **Anonymous**.
   - For the **two accounts** model, enable **Email/Password**, then add your
     two users under the *Users* tab with **Add user**. Copy each one's
     **User UID** — you will need both in step 3.
5. Project settings (the gear, top left) → scroll to **Your apps** → the
   **`</>`** web icon → register the app → copy the `firebaseConfig` block it
   shows you.

Paste that block into `od/config.js`. Those values are not secrets — a
Firebase web config identifies the project, it does not authorise anything.
**What keeps the letters private is step 3, and nothing else.**

---

## 2. Choose how it is locked

### The link model — `OD.FIREBASE_MODE = 'anon'`

Every device signs itself in silently. Nothing to type, nothing to remember.
The letters live in a room whose id is a long random string that is **not in
this repository** — it travels in the link:

```
https://aravindjk03.github.io/our-dimension/#w=PASTE-A-LONG-RANDOM-STRING
```

The browser keeps the id once it has seen it, so each of you opens that link
once and can use the plain link forever after. Anyone who gets hold of the
link can read the letters, so it is the link that has to stay between you —
the same as any private share link.

Make an id with this, and paste it into the link, not into the repo:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### The two accounts model — `OD.FIREBASE_MODE = 'password'`

You each sign in once per device with an email and a password, and the rules
name your two accounts by UID. Nobody else can read a word, whatever they
find. Slightly more friction; genuinely private.

---

## 3. The rules — paste into Firestore → Rules → Publish

**Do not skip this.** Without it, a locked database rejects everything and the
world silently falls back to one-device-only; a permissive one puts your
letters on the open internet.

### For the link model

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // A room can only be opened by someone who already knows its id;
    // collections cannot be listed, so the id cannot be discovered.
    match /worlds/{world}/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### For the two accounts model

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid in [
        'PASTE-ARAVIND-UID',
        'PASTE-DIANA-UID'
      ];
    }
  }
}
```

---

## 4. What happens then

`od/backend.js` loads Firebase only if `od/config.js` has been filled in, and
a configured backend is preferred over everything else — including the
Artifact's own database — so that both of you land in the same world whichever
link you opened.

If it cannot connect, for any reason, the world still opens and still works:
it just falls back to this device's own storage, exactly as it does today.
Nothing is ever lost to a failed connection; it simply is not shared.

Anything already written on a device stays in that device's storage and is not
uploaded. Letters written from then on are shared.

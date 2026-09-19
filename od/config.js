/* ══════════════════════════════════════════════════════════════
   THE KEY TO THE SHARED WORLD

   Until this is filled in, every letter, wish and memory lives only in
   the browser that wrote it. Fill it in and the same world opens on both
   phones, on both laptops, from any of the links.

   These values are not secrets. A Firebase web config is meant to be
   public — it identifies the project, it does not authorise anything.
   What keeps the letters private is the rule file (see BACKEND.md), and
   nothing else. Do not skip it.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

OD.FIREBASE = {
  apiKey:            '',
  authDomain:        '',
  projectId:         '',
  storageBucket:     '',
  messagingSenderId: '',
  appId:             ''
};

/* 'anon'     — every device signs in silently; the rules keep the world
                behind an unguessable id that lives in OD.WORLD below.
   'password' — the two of you sign in once per device with an email and a
                password, and the rules name your two accounts. */
OD.FIREBASE_MODE = 'anon';

/* The shared world room ID.
   Used automatically so any device opening the world lands in the same room.
   Can also be overridden per-device via URL hash: .../our-dimension/#w=<custom-room-id> */
OD.WORLD = 'our-dimension-aravind-diana';

})(window.OD);

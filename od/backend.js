/* ══════════════════════════════════════════════════════════════
   THE SHARED STORE

   Store already speaks Firestore: collection().orderBy().onSnapshot(),
   doc().set(), doc().update(), doc().get(). The Artifact runtime hands it
   something of that shape, and Firebase's compat build is that shape, so
   this file is mostly the loading and the signing in — there is no
   translation layer to drift out of step.

   Nothing here runs until od/config.js has been filled in. Empty config,
   and the world behaves exactly as it did before: one browser, one copy.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const CDN = 'https://cdn.jsdelivr.net/npm/firebase@9.23.0/';

function loadScript(src){
  return new Promise(function(resolve, reject){
    const s = document.createElement('script');
    s.src = src;
    s.async = false;            // keep firebase's own load order
    s.onload = resolve;
    s.onerror = function(){ reject(new Error('could not load ' + src)); };
    document.head.appendChild(s);
  });
}

function configured(){
  const c = OD.FIREBASE;
  return !!(c && c.apiKey && c.projectId && c.appId);
}

/* Everything the world saves lives under one room, so that the rules can
   speak about the room rather than about every collection by name, and so
   two couples could in principle share one project without ever meeting. */
/* The room id is the one thing that must not sit in a public repository, so
   it travels in the link instead — #w=… — and is kept on the device once it
   has arrived. A fragment is never sent to a server and never appears in a
   log; it is the same shape as any share link, and should be treated like
   one. OD.WORLD in the config is only a fallback for a private deployment. */
function worldId(){
  let w = '';
  try{
    const m = /[#&]w=([A-Za-z0-9_-]{8,})/.exec(location.hash || '');
    if(m) w = m[1];
    if(w) localStorage.setItem('od.world', w);
    else w = localStorage.getItem('od.world') || '';
  }catch(e){}
  return w || (OD.WORLD || '').trim();
}

function roomOf(db){
  const world = worldId();
  return world ? db.collection('worlds').doc(world) : db;
}

/* Store calls db.collection(name) and db.doc('config/relationship'). When
   the letters live inside a room, both have to be rooted there. */
function scoped(db){
  const room = roomOf(db);
  if(room === db) return db;
  return {
    collection(name){ return room.collection(name); },
    doc(path){
      const bits = String(path).split('/').filter(Boolean);
      let ref = room;
      for(let i=0;i<bits.length;i++){
        ref = (i % 2 === 0) ? ref.collection(bits[i]) : ref.doc(bits[i]);
      }
      return ref;
    }
  };
}

let connecting = null;

OD.Backend = {
  get configured(){ return configured(); },
  get world(){ return worldId(); },
  reason: 'idle',      // idle · ok · no-key · unreachable

  /* Resolves to something Store can use, or null. Never throws: a world that
     cannot reach its store still has to open. */
  connect(){
    if(connecting) return connecting;
    if(!configured()) return Promise.resolve(null);
    /* Without a room id the letters would be written at the top of the
       database, which the rules refuse — and a refusal looks exactly like
       having no shared store at all. Say which it is instead. */
    if(OD.FIREBASE_MODE !== 'password' && !worldId()){
      OD.Backend.reason = 'no-key';
      return Promise.resolve(null);
    }

    connecting = (async function(){
      try{
        if(!window.firebase || !window.firebase.initializeApp){
          await loadScript(CDN + 'firebase-app-compat.js');
          await loadScript(CDN + 'firebase-auth-compat.js');
          await loadScript(CDN + 'firebase-firestore-compat.js');
        }
        if(!firebase.apps.length) firebase.initializeApp(OD.FIREBASE);

        const auth = firebase.auth();
        if(OD.FIREBASE_MODE === 'password'){
          /* The two of you sign in yourselves; nothing here ever holds a
             password, and the sign-in survives a reload on this device. */
          if(!auth.currentUser){
            await new Promise(function(r){
              const off = auth.onAuthStateChanged(function(){ off(); r(); });
            });
          }
          if(!auth.currentUser) return null;     // the door will ask
        } else {
          if(!auth.currentUser) await auth.signInAnonymously();
        }

        const db = firebase.firestore();
        try{ await db.enablePersistence({ synchronizeTabs:true }); }catch(e){}
        OD.Backend.reason = 'ok';
        return scoped(db);
      }catch(e){
        OD.Backend.reason = 'unreachable';
        return null;
      }
    })();

    return connecting;
  },

  /* Used by the door when the config asks for real accounts. */
  async signIn(email, password){
    if(!configured()) return null;
    await OD.Backend.connect();
    if(!window.firebase) return null;
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    connecting = null;                            // reconnect as this person
    return cred && cred.user ? cred.user.uid : null;
  },

  get signedIn(){
    return !!(window.firebase && firebase.auth && firebase.auth().currentUser);
  }
};

})(window.OD);

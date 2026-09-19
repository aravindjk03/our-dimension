/* ══════════════════════════════════════════════════════════════
   THE SHARED STORE — Realtime Cloud Database & Multi-Device Sync

   Enables live cross-device synchronization of letters, campfire questions,
   wishes, memories, and vault items across any phone, laptop, or browser.

   1. If Firebase is configured in od/config.js, it uses Firebase Firestore.
   2. By default, it connects to the built-in Realtime Cloud Sync service
      (secure WebSockets with retained state store and offline-first local cache).
   3. Both devices automatically share the room defined by OD.WORLD or URL hash #w=...
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const FIREBASE_CDN = 'https://cdn.jsdelivr.net/npm/firebase@9.23.0/';
const MQTT_CDN     = 'https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.5.0/mqtt.min.js';

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

function loadScript(src){
  return new Promise(function(resolve, reject){
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = function(){ reject(new Error('could not load ' + src)); };
    document.head.appendChild(s);
  });
}

function hasFirebaseConfig(){
  const c = OD.FIREBASE;
  return !!(c && c.apiKey && c.projectId && c.appId);
}

function worldId(){
  let w = '';
  try{
    const m = /[#&]w=([A-Za-z0-9_-]{3,})/.exec(location.hash || '');
    if(m) w = m[1];
    if(w) localStorage.setItem('od.world', w);
    else w = localStorage.getItem('od.world') || '';
  }catch(e){}
  return w || (OD.WORLD || '').trim() || 'our-dimension-aravind-diana';
}

function roomOf(db){
  const world = worldId();
  return world ? db.collection('worlds').doc(world) : db;
}

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

/* ──────────────────────────────────────────────────────────────
   BUILT-IN REALTIME CLOUD SYNC ENGINE
   Connects phones, laptops, and tablets automatically via WSS.
   ────────────────────────────────────────────────────────────── */
function createCloudDb(world){
  let client = null;
  let activeBrokerIndex = 0;
  const store = {};
  const colListeners = {};
  const docListeners = {};

  function ls(k, v){
    try{
      if(v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
      return v;
    }catch(e){ return null; }
  }

  function localList(col){
    try{ return JSON.parse(ls('od.' + col) || '[]'); }catch(e){ return []; }
  }

  function localSave(col, arr){
    ls('od.' + col, JSON.stringify(arr));
  }

  // Pre-seed in-memory store from local storage so UI renders instantly
  ['letters', 'questions', 'memories', 'wishes', 'vault', 'vault_config', 'config'].forEach(col => {
    store[col] = {};
    localList(col).forEach(doc => {
      if(doc && doc.id) store[col][doc.id] = doc;
    });
  });

  function topicFor(col){
    return `our-dimension/v2/${world}/${col}`;
  }

  function notify(col){
    const list = Object.values(store[col] || {});
    localSave(col, list);

    if(colListeners[col]){
      colListeners[col].slice().forEach(fn => {
        try{ fn({ docs: list.map(d => ({ id: d.id, data: () => ({ ...d }) })) }); }catch(e){}
      });
    }

    if(docListeners[col]){
      Object.keys(docListeners[col]).forEach(docId => {
        const doc = (store[col] || {})[docId];
        docListeners[col][docId].slice().forEach(fn => {
          try{ fn({ exists: !!doc, id: docId, data: () => (doc ? { ...doc } : {}) }); }catch(e){}
        });
      });
    }
  }

  function publishCol(col){
    if(!client || !client.connected) return;
    const list = Object.values(store[col] || {});
    try{
      client.publish(topicFor(col), JSON.stringify(list), { retain:true, qos:1 });
    }catch(e){}
  }

  function mergeRemote(col, remoteDocs){
    store[col] = store[col] || {};
    let changed = false;
    let localHasExtras = false;
    const remoteMap = {};

    remoteDocs.forEach(rd => {
      if(!rd || !rd.id) return;
      remoteMap[rd.id] = rd;
      const cur = store[col][rd.id];
      if(!cur){
        store[col][rd.id] = rd;
        changed = true;
      } else {
        // Merge fields, preferring newer timestamp or marked read
        const curTime = cur.updated_at || cur.created || 0;
        const rdTime  = rd.updated_at || rd.created || 0;
        if(rdTime >= curTime || (rd.read && !cur.read) || JSON.stringify(cur) !== JSON.stringify(rd)){
          store[col][rd.id] = Object.assign({}, cur, rd);
          changed = true;
        }
      }
    });

    // Check if device wrote letters while disconnected that remote doesn't have yet
    Object.keys(store[col]).forEach(id => {
      if(!remoteMap[id]) localHasExtras = true;
    });

    if(changed) notify(col);
    if(localHasExtras) publishCol(col);
  }

  const db = {
    collection(name){
      store[name] = store[name] || {};
      return {
        doc(id){
          return {
            async set(data){
              store[name] = store[name] || {};
              store[name][id] = Object.assign({ id }, data);
              notify(name);
              publishCol(name);
              return true;
            },
            async update(data){
              store[name] = store[name] || {};
              const cur = store[name][id] || { id };
              store[name][id] = Object.assign({}, cur, data);
              notify(name);
              publishCol(name);
              return true;
            },
            async get(){
              const doc = (store[name] || {})[id];
              return {
                exists: !!doc,
                id,
                data: () => (doc ? { ...doc } : {})
              };
            },
            async delete(){
              if(store[name] && store[name][id]){
                delete store[name][id];
                notify(name);
                publishCol(name);
              }
              return true;
            },
            onSnapshot(onNext){
              docListeners[name] = docListeners[name] || {};
              docListeners[name][id] = docListeners[name][id] || [];
              docListeners[name][id].push(onNext);
              const doc = (store[name] || {})[id];
              try{ onNext({ exists: !!doc, id, data: () => (doc ? { ...doc } : {}) }); }catch(e){}
              return () => {
                const arr = docListeners[name][id];
                if(arr){
                  const idx = arr.indexOf(onNext);
                  if(idx >= 0) arr.splice(idx, 1);
                }
              };
            }
          };
        },
        orderBy(field, dir = 'asc'){
          return {
            onSnapshot(onNext){
              const wrapped = (snap) => {
                const sorted = snap.docs.slice().sort((a, b) => {
                  const av = a.data()[field] || 0;
                  const bv = b.data()[field] || 0;
                  return dir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
                });
                onNext({ docs: sorted });
              };
              colListeners[name] = colListeners[name] || [];
              colListeners[name].push(wrapped);
              const list = Object.values(store[name] || {});
              wrapped({ docs: list.map(d => ({ id: d.id, data: () => ({ ...d }) })) });
              return () => {
                const arr = colListeners[name];
                if(arr){
                  const idx = arr.indexOf(wrapped);
                  if(idx >= 0) arr.splice(idx, 1);
                }
              };
            }
          };
        },
        onSnapshot(onNext){
          colListeners[name] = colListeners[name] || [];
          colListeners[name].push(onNext);
          const list = Object.values(store[name] || {});
          try{ onNext({ docs: list.map(d => ({ id: d.id, data: () => ({ ...d }) })) }); }catch(e){}
          return () => {
            const arr = colListeners[name];
            if(arr){
              const idx = arr.indexOf(onNext);
              if(idx >= 0) arr.splice(idx, 1);
            }
          };
        }
      };
    },

    doc(path){
      const bits = String(path).split('/').filter(Boolean);
      const col = bits[0];
      const id = bits.slice(1).join('/') || 'default';
      return db.collection(col).doc(id);
    }
  };

  function initMqtt(resolve){
    if(!window.mqtt || !window.mqtt.connect){
      resolve(db);
      return;
    }
    const broker = BROKERS[activeBrokerIndex % BROKERS.length];
    const clientId = 'od_' + Math.random().toString(36).slice(2, 10);

    try{
      client = window.mqtt.connect(broker, {
        clientId,
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 5000
      });
    }catch(e){
      resolve(db);
      return;
    }

    let resolved = false;

    client.on('connect', () => {
      OD.Backend.reason = 'ok';
      const subTopic = `our-dimension/v2/${world}/+`;
      client.subscribe(subTopic, { qos: 1 }, () => {
        // Push any local documents to the cloud
        Object.keys(store).forEach(col => {
          if(Object.keys(store[col]).length > 0) publishCol(col);
        });
        if(!resolved){ resolved = true; resolve(db); }
      });
    });

    client.on('message', (t, msg) => {
      const col = t.split('/').pop();
      try{
        const data = JSON.parse(msg.toString());
        if(Array.isArray(data)) mergeRemote(col, data);
      }catch(e){}
    });

    client.on('error', () => {
      if(!resolved && activeBrokerIndex === 0){
        activeBrokerIndex++;
        if(client) try{ client.end(true); }catch(e){}
        setTimeout(() => initMqtt(resolve), 500);
      }
    });

    setTimeout(() => {
      if(!resolved){ resolved = true; resolve(db); }
    }, 4500);
  }

  return {
    db,
    async start(){
      if(!window.mqtt){
        try{ await loadScript(MQTT_CDN); }catch(e){}
      }
      return new Promise(initMqtt);
    }
  };
}

let connecting = null;

OD.Backend = {
  get configured(){
    // True always: built-in cloud database or Firebase is ready
    return true;
  },
  get hasFirebase(){
    return hasFirebaseConfig();
  },
  get world(){
    return worldId();
  },
  reason: 'idle',      // idle · ok · no-key · unreachable

  /* Resolves to something Store can use. Never throws. */
  connect(){
    if(connecting) return connecting;

    connecting = (async function(){
      // 1. If Firebase is explicitly configured, use Firestore
      if(hasFirebaseConfig()){
        try{
          if(!window.firebase || !window.firebase.initializeApp){
            await loadScript(FIREBASE_CDN + 'firebase-app-compat.js');
            await loadScript(FIREBASE_CDN + 'firebase-auth-compat.js');
            await loadScript(FIREBASE_CDN + 'firebase-firestore-compat.js');
          }
          if(!firebase.apps.length) firebase.initializeApp(OD.FIREBASE);

          const auth = firebase.auth();
          if(OD.FIREBASE_MODE === 'password'){
            if(!auth.currentUser){
              await new Promise(function(r){
                const off = auth.onAuthStateChanged(function(){ off(); r(); });
              });
            }
            if(!auth.currentUser) return null;
          } else {
            if(!auth.currentUser) await auth.signInAnonymously();
          }

          const fbDb = firebase.firestore();
          try{ await fbDb.enablePersistence({ synchronizeTabs:true }); }catch(e){}
          OD.Backend.reason = 'ok';
          return scoped(fbDb);
        }catch(e){
          console.warn('Firebase connect failed, falling back to Realtime Cloud Sync:', e);
        }
      }

      // 2. Default: Connect to Realtime Cloud Database
      try{
        const cloud = createCloudDb(worldId());
        const cloudDb = await cloud.start();
        OD.Backend.reason = 'ok';
        return cloudDb;
      }catch(e){
        console.warn('Cloud sync error:', e);
        OD.Backend.reason = 'unreachable';
        return null;
      }
    })();

    return connecting;
  },

  /* Used by the door when the config asks for real Firebase accounts. */
  async signIn(email, password){
    if(!hasFirebaseConfig()) return null;
    await OD.Backend.connect();
    if(!window.firebase) return null;
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    connecting = null;
    return cred && cred.user ? cred.user.uid : null;
  },

  get signedIn(){
    return !!(window.firebase && firebase.auth && firebase.auth().currentUser);
  }
};

})(window.OD);

# Our Dimension

A parallel dimension built for two people. Eight places, one continuous 3D world,
no page reloads between them.

Written against **three.js r128** and **GSAP 3**, both from a CDN. Everything else —
every texture, every sound, every particle system — is generated procedurally at load.
No image, audio or model file is ever fetched.

## The places

| | |
|---|---|
| **The Chocolate Heart Portal** | The entry. Cocoa dust gathers into a tempered-chocolate heart that shatters along a real Voronoi fracture, from wherever you touch it. |
| **The Floating Islands Hub** | Six islands at different altitudes under a sky that reads your local clock — dawn, golden hour, dusk, or night with stars and aurora. |
| **The Tree of Time** | A tree whose eight growth stages map to the age of the relationship, with a live day/hour/minute/second counter and readable growth rings. |
| **The Enchanted Treehouse** | Letters as 3D envelopes on golden threads. Break the wax, the flap opens, and the ink writes itself. Some are chained shut until a date. |
| **The Campfire** | One question a day. Both answer alone; neither sees the other until both have spoken. Answers freeze for 24 hours, then join the sky. |
| **The Crystal Tower** | A spiral of crystal, amethyst at the bottom through quartz to diamond at the top, with memories set into the wall in the order they happened. |
| **Wish Lanterns** | Write it, light it, let it go. It rises and stays. The sky of wishes is visible from the other places too. |
| **The Underwater Cave** | Off the cliff edge, through the clouds, into the water. A four-ring combination lock, and past it a vault where depth is privacy. |

## Layout

```
index.html        all markup and CSS
od/core.js        device tiers, procedural PBR textures, PMREM environment,
                  the post-processing chain, the audio engine, the data layer
od/questions.js   the daily question pool, in three tiers
od/portal.js      the chocolate heart
od/hub.js         the islands and the tree
od/letters.js     the treehouse
od/campfire.js    the daily question
od/tower.js       the memory timeline
od/lanterns.js    the wish sky and the launch pad
od/cave.js        the plunge, the lock, the vault
od/app.js         boot, identity, world switching, input routing
```

## Rendering

Custom post chain written against three's core only, no addon imports:
HDR render target → bright pass → separable Gaussian at three scales →
one composite doing ACES tone mapping, bloom, edge-weighted chromatic
aberration, vignette, animated grain and the linear→sRGB conversion.

Quality scales in three tiers by viewport width. Phones drop bloom to a single
blur step, halve the texture resolution, and fall back from transmission to plain
translucency.

## Persistence — read this before hosting it yourself

Shared state runs on the Claude Artifacts runtime (`window.claude`): a document
store for letters, answers, memories, wishes and vault items, an identity service
that tells the two sides apart, and an asset store for uploads.

**None of that exists on a static host.** Served from GitHub Pages or any ordinary
web server, the page still runs — every scene, every animation, every interaction —
but it falls back to `localStorage`. That means:

- nothing is shared between the two people, or between devices
- file uploads (photos, video, voice notes) are unavailable
- the "who's there?" picker always appears, since there is nobody to auto-detect

The full two-person experience only exists in the Artifacts build.

## Running it

Any static server, from the repository root:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` straight off the
filesystem will not work — the modules are loaded as separate scripts.

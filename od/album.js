/* ══════════════════════════════════════════════════════════════
   THE ALBUM
   The photographs that ship with the world. They hang on the Tree of
   Time as fruit and they fill the spiral of the Crystal Tower, from
   one source, so the two places can never disagree.

   ON THE DATES: only one of these is real — the sixth carries a
   timestamp burned into the picture itself (17 May 2024). The rest are
   spread across the years so the tower reads as a climb, and each is
   flagged `placeholder` so the page can say so rather than quietly
   inventing a history. Correct any of them from the Crystal Tower and
   the correction is what sticks.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

const SHEET = [
  { file:'photos/01.jpg', date:'2021-06-20', placeholder:true  },
  { file:'photos/02.jpg', date:'2022-02-14', placeholder:true  },
  { file:'photos/03.jpg', date:'2022-11-05', placeholder:true  },
  { file:'photos/04.jpg', date:'2023-07-22', placeholder:true  },
  { file:'photos/05.jpg', date:'2024-01-13', placeholder:true  },
  { file:'photos/06.jpg', date:'2024-05-17', placeholder:false },
  { file:'photos/07.jpg', date:'2025-03-09', placeholder:true  }
];

OD.SEED_MEMORIES = SHEET.map(function(p, i){
  return {
    id: 'seed-' + String(i+1).padStart(2,'0'),
    date: p.date + 'T12:00:00',
    title: '',
    caption: '',
    type: 'photo',
    asset_url: p.file,
    placeholder: p.placeholder,
    seeded: true,
    added_by: 'him',
    added_at: new Date(p.date + 'T12:00:00').getTime()
  };
});

})(window.OD);

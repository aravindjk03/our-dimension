/* ══════════════════════════════════════════════════════════════
   THE QUESTION POOL
   Three tiers that unlock with the age of the relationship.
   Tier 1 opens on day one, tier 2 after a month, tier 3 after
   four months. Index = days since the start, so you both get the
   same question on the same day with nothing to synchronise.
   ══════════════════════════════════════════════════════════════ */
(function(OD){
"use strict";

OD.QUESTIONS = {

  /* ── tier 1 — light, easy, said out loud ─────────────────── */
  t1: [
    "What did you eat today, and was it any good?",
    "What made you laugh most recently?",
    "What song has been stuck in your head this week?",
    "If I turned up at your door right now with one thing, what should it be?",
    "What's the last photo you took?",
    "What small thing are you looking forward to?",
    "What would your ideal lazy Sunday with me look like?",
    "What's something you're better at than you let on?",
    "Describe today in exactly three words.",
    "What's the last thing that annoyed you more than it deserved?",
    "Sweet or savoury, and defend it.",
    "What's your comfort film — the one you've seen too many times?",
    "If we had a free plane ticket tomorrow, where are we going?",
    "What's the nicest thing a stranger has ever done for you?",
    "What smell takes you straight back somewhere?",
    "What did you want to be when you were eight?",
    "What are you wearing right now? Be honest.",
    "What's the last thing you saved a picture of?",
    "What's your most useless talent?",
    "Which of us would survive longer in a horror film, and why is it not you?",
    "What did you think of me the very first time?",
    "What's something you'd eat every single day without getting bored?",
    "What's the best thing you've bought this year?",
    "What would you do with a completely empty day?",
    "What's a compliment you still remember?",
    "What's the weather doing where you are, and how do you feel about it?",
    "What's the last thing you googled?",
    "If our story were a film, what's the opening shot?",
    "What's something you find beautiful that other people don't notice?",
    "What's your order at the place we'd go most often?",
    "What's the most recent thing that made you say 'I have to tell them this'?",
    "What's a habit of mine you'd never want me to lose?",
    "Which animal would you be, and which would I be?",
    "What's the best nap you've ever had?",
    "What do you do when you can't sleep?",
    "What's something you've been putting off?",
    "What made today survivable?",
    "What's a word you love the sound of?",
    "If you could freeze one ordinary moment with me and live in it, which?",
    "What's the kindest thing you did today, even if it was tiny?"
  ],

  /* ── tier 2 — deeper, asked quietly ──────────────────────── */
  t2: [
    "When did you last feel properly proud of yourself?",
    "What's something you needed to hear and nobody said?",
    "What do you do with a bad mood — sit in it, or run from it?",
    "What's a fear you've mostly outgrown?",
    "Which version of me do you miss, if any?",
    "What do you think I'm underestimating about myself?",
    "When do you feel most like yourself?",
    "What's something you've forgiven that you never said out loud?",
    "What do you need more of from me, honestly?",
    "What's a memory of us you return to when things are hard?",
    "What's the loneliest you've ever been?",
    "What did your parents teach you that you're still unlearning?",
    "When did you last cry, and did you let yourself?",
    "What's something about us that you'd never want to change?",
    "What do you think is the hardest thing about loving you?",
    "What do you think is the hardest thing about loving me?",
    "Where do you feel safest?",
    "What's a decision you're glad you made, even though it hurt?",
    "What do you want people to say about you when you're not in the room?",
    "What's something you want but feel silly wanting?",
    "How do you know when you trust someone?",
    "What's a apology you're still waiting for?",
    "What part of your day do you wish I could see?",
    "What do you think we're building?",
    "What's something you've never told anyone, but could tell me?",
    "When have I got you wrong?",
    "What does home mean to you — a place, or a person, or neither?",
    "What's the bravest thing you've done that nobody clapped for?",
    "What do you do that you know is self-sabotage?",
    "What would you tell yourself the week before we met?",
    "What do you find hardest to ask for?",
    "What's a promise you made to yourself?",
    "When did you last change your mind about something big?",
    "What's the thing you'd fight for without hesitating?",
    "What's a small way I could make your week easier?",
    "What are you carrying right now that you haven't put down?",
    "Which of your own qualities do you most want to keep?",
    "What did you believe about love before me, and what do you believe now?",
    "What's the silence between us that you'd like to fill?",
    "What do you hope I never find out — and why does that matter to you?"
  ],

  /* ── tier 3 — the ones that take a minute ────────────────── */
  t3: [
    "What does the life we're heading toward actually look like, in detail?",
    "What would you want said at your funeral, and by whom?",
    "What's the one thing you'd refuse to compromise on, ever?",
    "What do you think I'd be like at sixty?",
    "If everything went right, where are we in ten years — be specific.",
    "What part of yourself have you had to hide to be loved before?",
    "What's the most honest thing you could say to me right now?",
    "When have you felt most alone inside a relationship?",
    "What's a wound of yours that I've accidentally touched?",
    "What do you owe yourself?",
    "What would you do if you knew you couldn't fail — and what's actually stopping you?",
    "What do you think is the point of all of this?",
    "Who are you when nobody needs anything from you?",
    "What's something you'd want our children to know, if there are any?",
    "What does forgiveness actually require from you?",
    "What are you most afraid of losing?",
    "What's a story you tell about yourself that isn't quite true anymore?",
    "If we had one year left, what would we change?",
    "What does it mean to you to be chosen?",
    "What have you learned about yourself from being loved by me?",
    "What would you need in order to feel completely known?",
    "What's the difference between what you want and what you think you deserve?",
    "What would you regret not saying?",
    "What do you think I've sacrificed for this?",
    "What's the hardest truth you've accepted?",
    "When did you last feel genuinely at peace?",
    "What does your worst day look like, and how would you want me in it?",
    "What are we each responsible for, in us?",
    "What's something you believe that most people around you don't?",
    "What would make you say this was a life well spent?",
    "How do you want to be loved when you're difficult?",
    "What's the question you're most afraid I'll ask?",
    "What do you want to be true about us that isn't yet?",
    "What have you stopped hoping for, and should you have?",
    "What would you want me to do if you got lost in yourself?",
    "What's the kindest possible interpretation of the person who hurt you most?",
    "What do you want your life to mean to one other person?",
    "What's something we've never talked about that we should?",
    "If you could send one sentence back to yourself on 6 April 2021, what is it?",
    "What are you certain of?"
  ],

  /* ── the gold ones, for days that deserve them ───────────── */
  special: {
    anniversary: "Today, of all days: what has surprised you most about this?",
    valentine:   "Say the thing you'd normally think was too much.",
    newyear:     "What do you want to leave behind, and what are you taking with you?"
  }
};

/* which question belongs to a given day */
OD.questionFor = function(date){
  const d = new Date(date || Date.now());          // never mutate the caller's date
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const s = OD.CFG.start;
  const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const days = Math.floor((dayStart - startDay) / 86400000);

  const occ = OD.Days.occasion(d);
  if(occ && OD.QUESTIONS.special[occ.kind]){
    return { text: OD.QUESTIONS.special[occ.kind], tier:0, special:true, occasion:occ.label };
  }

  const Q = OD.QUESTIONS;
  let pool = Q.t1.slice();
  let tier = 1;
  if(days >= 28){ pool = pool.concat(Q.t2); tier = 2; }
  if(days >= 120){ pool = pool.concat(Q.t3); tier = 3; }

  const i = ((days % pool.length) + pool.length) % pool.length;
  const text = pool[i];
  const t = Q.t3.indexOf(text) >= 0 ? 3 : (Q.t2.indexOf(text) >= 0 ? 2 : 1);
  return { text, tier:t, special:false, index:i, poolSize:pool.length, unlocked:tier };
};

})(window.OD);

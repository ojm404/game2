/* OutRanked party mode: 3 to 8 players take turns being "it".
   Loaded after the main script in index.html and uses its helpers (room, me, tally, keys, boardView, look, mark, ...).

   A round: "it" ranks the list honestly while everyone else guesses that ranking.
   Guessers score their own points (3 exact, 1 one tier off, 3 per perfect row) and the best guesser gets a bonus.
   "It" scores the group's average, so being easy to read pays. Everyone is "it" once; most points wins.
   Before the first round, each player picks a list for the next player's turn. Every round then uses the same number of
   items (the size of the shortest list picked), chosen at random, so nobody's turn is worth more than anyone else's.
   Fewer than 3 players left ends the game. The room stays open afterwards for another game. */

const PARTY_MIN = 3, PARTY_MAX = 8, BEST_BONUS = 2;
const SEATS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

// ---- who is who ----
const P = s => room.players[s];
const seatsIn = () => SEATS.filter(s => room.players && room.players[s]);
const active = () => seatsIn().filter(s => !P(s).left);                      // still in the room
const amHost = () => room.host === me.slot;
const sitting = s => !!(room.sit && room.sit[s] === room.round);             // host carried on without them this round
const participants = () => active().filter(s => s === room.it || !sitting(s));
const guessers = () => participants().filter(s => s !== room.it);
const pname = s => esc(P(s) ? P(s).name : "Someone");
const pcolor = s => look(s).color;
const tag = s => `<span style="--pc:${pcolor(s)};color:var(--pc)">${mark(s)}${pname(s)}</span>`;

function roundDone(){
  const it = P(room.it);
  return !!(room.started && it && !it.left && it.own && guessers().length && guessers().every(s => P(s).guess));
}
// The next player due to be "it", skipping anyone who has left. -1 when everyone has had a turn.
function nextItIndex(){
  const order = room.order || [];
  for (let i = (room.turn || 0) + 1; i < order.length; i++) if (P(order[i]) && !P(order[i]).left) return i;
  return -1;
}
const isFinalRound = () => roundDone() && nextItIndex() < 0;
// The host, or whoever was just "it", moves the game on to the next round.
const canAdvance = () => amHost() || room.it === me.slot;
const isFinal = () => !!room.closed || isFinalRound();
// Each player picks the list for the player after them in the turn order.
const targetOf = s => { const o = room.order || [], i = o.indexOf(s); return i < 0 ? null : o[(i + 1) % o.length]; };
const pickerOf = t => { const o = room.order || [], i = o.indexOf(t); return i < 0 ? null : o[(i - 1 + o.length) % o.length]; };
const randomList = () => { const ok = lists.filter(l => l.items && l.items.length >= 5); return ok[Math.floor(Math.random() * ok.length)] || lists[0]; };
// A random selection of n items from a list, kept in the list's own order.
function trimList(list, n){
  const ids = shuffle(list.items.map(x => x.id)).slice(0, n);
  return JSON.parse(JSON.stringify({title: list.title, items: list.items.filter(x => ids.includes(x.id))}));
}
// The tier names set when the room was made; used for any turn whose picker didn't choose their own.
const baseTiers = () => room.baseTiers || room.tiers || TIERS;
const sayCount = () => active().filter(s => s !== me.slot).reduce((t, s) => { const sy = P(s).say; return t + (sy && sy.r === room.round ? sy.n : 0); }, 0);

// ---- scores ----
function roundScores(){
  const own = P(room.it).own, res = {};
  guessers().forEach(s => { res[s] = tally(P(s).guess, own, keys()); });
  const base = Object.values(res).map(t => t.score);
  const top = base.length ? Math.max(...base) : 0;
  const best = top > 0 ? Object.keys(res).filter(s => res[s].score === top) : [];
  const itScore = base.length ? Math.round(base.reduce((a, b) => a + b, 0) / base.length) : 0;
  return {res, best, itScore};
}
// Running totals from every finished round in this room.
function partyTotals(){
  const tot = {};
  seatsIn().forEach(s => { tot[s] = {pts: 0, exact: 0, near: 0, cold: 0, last: 0}; });
  const last = (room.history || {})["r" + room.round];
  Object.values(room.history || {}).forEach(h => {
    if (!h || !h.g) return;
    const isLast = h === last;
    if (tot[h.it]) { tot[h.it].pts += h.its || 0; if (isLast) tot[h.it].last = h.its || 0; }
    Object.entries(h.g).forEach(([s, x]) => {
      if (!tot[s]) return;
      const p = (x.s || 0) + (x.b ? BEST_BONUS : 0);
      tot[s].pts += p; tot[s].exact += x.e || 0; tot[s].near += x.n || 0; tot[s].cold += x.c || 0;
      if (isLast) tot[s].last = p;
    });
  });
  return tot;
}
const standings = () => { const t = partyTotals(); return seatsIn().map(s => ({s, ...t[s]})).sort((a, b) => b.pts - a.pts || b.exact - a.exact); };
const roundsPlayed = () => Object.values(room.history || {}).filter(h => h && h.g).length;

// ---- keeping the room in step (runs on every update) ----
function partySync(){
  const mine = P(me.slot), seat = roomRef.child("players/" + me.slot);
  // Lock in, then reveal only once everyone taking part has locked in.
  if (room.started && me.step === "locked" && !mine.ready) seat.update({ready: true});
  const allReady = room.started && participants().every(s => P(s).ready);
  if (me.step === "locked" && mine.ready && allReady) {
    if (me.slot === room.it && !mine.own) seat.update({own: me.own});
    if (me.slot !== room.it && !mine.guess && !sitting(me.slot)) seat.update({guess: me.guess});
  }
  // Save the finished round once (any player may write it; the data is identical).
  const key = "r" + room.round;
  if (roundDone() && !(room.history || {})[key]) {
    const sc = roundScores(), g = {};
    Object.entries(sc.res).forEach(([s, t]) => { g[s] = {s: t.score, e: t.exact, n: t.near, c: t.cold, ...(sc.best.includes(s) ? {b: 1} : {})}; });
    roomRef.child("history/" + key).set({list: L().title, it: room.it, its: sc.itScore, g});
  }
  // If the host has left, the first remaining player takes over.
  const host = P(room.host);
  if ((!host || host.left) && active()[0] === me.slot) {
    const old = room.host;
    roomRef.child("host").transaction(cur => cur === old ? me.slot : undefined);
  }
  if (!amHost() || room.closed) return;
  if (room.started && room.picking) {
    const picks = room.picks || {}, needed = (room.order || []).filter(t => P(t) && !P(t).left);
    const waiting = needed.filter(t => !picks[t] && P(pickerOf(t)) && !P(pickerOf(t)).left);
    if (!waiting.length && needed.length >= PARTY_MIN) beginPlay(needed, picks);
  }
  // Host duties: end the game when fewer than 3 are left, and move on if "it" has left mid-round.
  if (room.started && active().length < PARTY_MIN) { roomRef.update({closed: {few: true}}); return; }
  if (room.started && !room.picking && P(room.it) && P(room.it).left && !roundDone()) partyAdvance();
}
// All lists are in: set the item count for the whole game and start round 1.
function beginPlay(needed, picks){
  const all = {...picks};
  needed.forEach(t => { if (!all[t]) all[t] = {by: null, list: randomList()}; });      // a picker left without choosing
  const size = Math.min(...needed.map(t => all[t].list.items.length));
  const i = (room.order || []).findIndex(t => needed.includes(t)), it = room.order[i];
  const u = {picking: false, picks: all, size, round: room.round + 1, turn: i, it, sit: null, list: trimList(all[it].list, size), tiers: all[it].tiers || baseTiers()};
  seatsIn().forEach(s => { u["players/" + s + "/ready"] = false; u["players/" + s + "/own"] = null; u["players/" + s + "/guess"] = null; });
  roomRef.update(u);
}
function partyAdvance(){
  const i = nextItIndex();
  if (i < 0) { roomRef.update({closed: {done: true}}); return; }
  const it = room.order[i], pick = (room.picks || {})[it];
  const u = {round: room.round + 1, turn: i, it, sit: null, list: trimList(pick ? pick.list : randomList(), room.size || 10), tiers: (pick && pick.tiers) || baseTiers()};
  seatsIn().forEach(s => { u["players/" + s + "/ready"] = false; u["players/" + s + "/own"] = null; u["players/" + s + "/guess"] = null; });
  roomRef.update(u);
}

// ---- screens ----
let partyResultsRound = null;
function partyStatus(){
  const st = !room.started ? `Party lobby: ${active().length} of ${PARTY_MAX}`
    : room.picking ? "Choosing lists"
    : `Round ${(room.turn || 0) + 1} of ${(room.order || []).length}. ${tag(room.it)} is it`;
  const chip = s => {
    const p = P(s), on = room.started;
    const picked = room.picking && Object.values(room.picks || {}).some(x => x.by === s);
    const state = p.left ? "left" : sitting(s) ? "sitting out" : p.online === false || p.away ? "away"
      : !on ? "" : room.picking ? (picked ? "picked" : "choosing") : roundDone() ? "" : p.ready ? "locked in" : s === room.it ? "ranking" : "guessing";
    return `<span class="pchip${p.left ? " gone" : ""}${on && s === room.it ? " it" : ""}" style="--pc:${pcolor(s)}">${mark(s)}${pname(s)}${room.host === s ? " \u{1F451}" : ""}${state ? `<span class="st">${state}</span>` : ""}</span>`;
  };
  return `<div class="status"><span class="rc" title="Room code">${esc(me.code)}</span><span>${st}</span>
      <button class="link" data-act="leave">Leave room</button></div>
    <div class="plist">${seatsIn().map(chip).join("")}</div>`;
}
function partyLobby(){
  const n = active().length, hostName = pname(room.host);
  const invite = `<button class="btn ghost" data-act="invite">Copy invite link</button>`;
  return `<div class="panel"><h2>Waiting for players</h2>
    <p class="hint">Share the room code ${esc(me.code)}. A party needs ${PARTY_MIN} to ${PARTY_MAX} players. Once the host starts, everyone picks a list for someone else's turn.</p>
    ${amHost()
      ? `<div class="actions">${invite}<button class="btn" data-act="partyStart" ${n >= PARTY_MIN ? "" : "disabled"}>Start the game</button></div>
         ${n < PARTY_MIN ? `<p class="hint" style="margin-top:8px">Waiting for ${PARTY_MIN - n} more ${PARTY_MIN - n === 1 ? "player" : "players"}.</p>` : ""}`
      : `<p class="hint">${hostName} will start the game once everyone is in.</p><div class="actions">${invite}</div>`}</div>`;
}
let partyPickRound = null;
function partyPicking(){
  if (partyPickRound !== room.round) {
    partyPickRound = room.round; pickId = null; pickOpen = false;
    tierNames = baseTiers().concat(["", "", "", "", "", ""]).slice(0, 6);      // start from the room's usual tier names
  }
  const t = targetOf(me.slot), mine = Object.values(room.picks || {}).find(x => x.by === me.slot);
  const sizes = Object.values(room.picks || {}).map(x => x.list.items.length), smallest = sizes.length ? Math.min(...sizes) : null;
  const sizeNote = `<p class="hint" style="font-size:.85rem">Every round uses the same number of items, so the shortest list anyone picks sets the size for the whole game${smallest ? ` (${smallest} so far)` : ""}. Longer lists are cut down to a random selection.</p>`;
  if (mine || !t || !P(t) || P(t).left) {
    const still = (room.order || []).map(pickerOf).filter((s, i, a) => a.indexOf(s) === i)
      .filter(s => P(s) && !P(s).left && !Object.values(room.picks || {}).some(x => x.by === s));
    return `<div class="panel"><h2>${mine ? "List picked" : "Nothing to pick"}</h2>
      <p class="hint">${mine ? `You chose ${esc(mine.list.title)} for ${tag(t)}'s turn. ` : ""}${still.length ? `Waiting for ${still.map(tag).join(", ")}.` : "Starting..."}</p>${sizeNote}</div>`;
  }
  return `<div class="panel"><h2>Pick a list for ${tag(t)}'s turn</h2>
    <p class="hint">${pname(t)} will rank it, and everyone else will try to guess how.</p>
    <div class="picker" role="group" aria-label="List for ${pname(t)}"></div>
    ${sizeNote}
    ${tierEditor()}
    <div class="actions"><button class="btn" data-act="partyPick">Use this list</button></div></div>`;
}
function partyWaiting(){
  const waiting = participants().filter(s => !P(s).ready);
  const itWaiting = waiting.includes(room.it), others = waiting.filter(s => s !== room.it);
  let tools = "";
  if (amHost() && others.length) tools += `<button class="btn ghost" data-act="partySit">Carry on without ${others.map(pname).join(", ")}</button>`;
  if (amHost() && itWaiting && room.it !== me.slot) tools += `<button class="btn ghost" data-act="partySkip">Skip ${pname(room.it)}'s turn</button>`;
  return `<div class="panel"><h2>Locked in</h2>
    <p class="hint">${waiting.length ? `Waiting for ${waiting.map(tag).join(", ")}.` : "Revealing..."}</p>
    ${tools ? `<p class="hint" style="margin:10px 0 6px;font-size:.85rem">Host options, for when someone has stepped away:</p><div class="actions" style="margin-top:0">${tools}</div>` : ""}</div>`;
}
// The "it" player's real ranking, with the emoji of everyone who placed each one exactly.
function partyBoard(){
  const own = P(room.it).own, gs = guessers();
  const rows = keys().map(t => {
    const tiles = L().items.filter(a => own[a.id] === t).map(a => {
      const hits = gs.filter(s => P(s).guess[a.id] === t);
      return tileHtml(a, hits.length ? "hit" : "plain", hits.length ? "Exact: " + hits.map(s => P(s).name).join(", ") : "Nobody got this one", "")
        .replace('<span class="heat"></span>', `<span class="who">${hits.map(s => look(s).emoji || "\u2022").join("")}</span>`);
    }).join("");
    return `<div class="row reveal" data-tier="${t}"><div class="tl">${tlabel(t)}</div><div class="cells">${tiles || '<span class="none">nothing</span>'}</div></div>`;
  }).join("");
  return `<div class="grid${longTiers() ? " long" : ""}">${rows}</div>`;
}
function leaderboard(showLast){
  return `<table class="lb">${standings().map((r, i) => `<tr class="${r.s === me.slot ? "me" : ""}"><td class="n">${i + 1}</td>
    <td>${tag(r.s)}${P(r.s).left ? ' <span class="st" style="color:var(--muted)">(left)</span>' : ""}</td>
    <td class="pt">${r.pts}${showLast && r.last ? `<small>+${r.last}</small>` : ""}</td></tr>`).join("")}</table>`;
}
function partyResults(){
  const sc = roundScores();
  return `<p class="verdict">${tag(room.it)}'s ranking</p>
    <p class="hint">${esc(L().title)}. Under each one: the emoji of everyone who placed it exactly.</p>
    ${partyBoard()}
    <h2 style="margin-top:20px">Leaderboard</h2>${leaderboard(true)}
    <p class="hint">${pname(room.it)} scored ${sc.itScore}, the group's average.${sc.best.length ? ` Best guess: ${sc.best.map(pname).join(" and ")} (+${BEST_BONUS} bonus).` : ""}</p>
    <div class="actions"><button class="btn" data-act="openRound">${isFinal() ? "Final results and chat" : "Round summary and next steps"}</button></div>`;
}
function partyDraw(){
  const head = partyStatus();
  if (!room.started) return head + partyLobby();
  if (room.picking) return head + partyPicking();
  if (roundDone()) return head + partyResults();
  if (sitting(me.slot)) return head + `<div class="panel"><h2>Sitting this one out</h2><p class="hint">The round carried on without you. You're back in for the next one.</p></div>`;
  if (me.step !== "locked") { const want = me.slot === room.it ? "own" : "guess"; if (me.step !== want) me.step = want; }
  if (me.step === "locked") return head + partyWaiting();
  return head + boardView(P(room.it).name);
}

// ---- pop-ups ----
function partyUpdateModal(){
  if (modal && modal.kind === "hostleave") return;
  if (room.started && !room.picking && isFinal()) {
    // Chat opens once the game is over; a new message brings the final results back up.
    const key = "final:" + room.round, n = sayCount();
    if (seen.round !== key) { seen.round = key; seen.say = n; modal = {kind: "pfinal"}; }
    else if (n > seen.say) { seen.say = n; modal = {kind: "pfinal"}; }
    return;
  }
  if (room.closed && !room.started) return;
  if (room.closed) { modal = {kind: "pfinal"}; return; }
  if (modal && modal.kind === "pfinal") modal = null;
  if (roundDone()) { if (seen.round !== room.round) { seen.round = room.round; modal = {kind: "pround"}; } }
  else if (modal && modal.kind === "pround") modal = null;
}
function partyModalHtml(){
  if (modal.kind === "hostleave") {
    return `<h2>Hand over hosting</h2><p>Pick who runs the room after you leave.</p>
      <div class="says">${active().filter(s => s !== me.slot).map(s => `<button data-act="handHost" data-s="${s}" style="--pc:${pcolor(s)}">${mark(s)}${pname(s)}</button>`).join("")}</div>
      <div class="actions"><button class="btn ghost" data-act="closeModal">Stay in the room</button></div>`;
  }
  const close = `<button class="x" data-act="closeModal">View the board</button>`;
  if (modal.kind === "pfinal" || isFinal()) {
    const c = room.closed || {};
    const why = c.few ? "Only two players are left, so this game is over." : c.by ? `${pname(c.by)} ended the game.` : "Everyone has had a turn.";
    const says = `<p class="sublabel">Say something</p><div class="says">${SAY.map((t, i) => `<button data-act="say" data-i="${i}">${esc(t)}</button>`).join("")}</div>`;
    const next = amHost()
      ? `<div class="actions"><button class="btn" data-act="partyAgain">Play another game</button><button class="btn ghost" data-act="leave">Leave room</button></div>
         <p class="hint" style="margin-top:8px;font-size:.85rem">Everyone still here goes back to the lobby, and new players can join.</p>`
      : `<p>${tag(room.host)} can start another game in this room.</p><div class="actions"><button class="btn ghost" data-act="leave">Leave room</button></div>`;
    return `${roundsPlayed() ? close : ""}<h2>Final results</h2><p>${why}</p>
      ${roundsPlayed() ? leaderboard(false) : "<p>No rounds were finished.</p>"}
      ${chatLog()}${says}
      <p class="sublabel">What next?</p>${next}`;
  }
  // end of a round (chat stays closed until the game is over)
  const sc = roundScores(), nextIt = room.order[nextItIndex()];
  const next = canAdvance()
    ? `<div class="actions"><button class="btn" data-act="partyNext">Start next round</button>${amHost() ? `<button class="btn ghost" data-act="partyEnd">End game</button>` : ""}</div>`
    : `<p>Waiting for ${tag(room.host)}${room.it !== room.host ? ` or ${tag(room.it)}` : ""} to start the next round.</p>`;
  return `${close}
    <h2>Round ${(room.turn || 0) + 1} results</h2>
    <p>${tag(room.it)} was it and scored ${sc.itScore}.${sc.best.length ? ` Best guess: ${sc.best.map(tag).join(" and ")}.` : ""}</p>
    ${leaderboard(true)}
    <p class="sublabel">Next up</p>
    <p>${tag(nextIt)} is it, ranking ${esc(((room.picks || {})[nextIt] || {list: {title: "a random list"}}).list.title)}${((room.picks || {})[nextIt] || {}).tiers ? ` with tiers ${esc(room.picks[nextIt].tiers.join(", "))}` : ""}.</p>
    ${next}`;
}

// ---- copy results ----
function partyShareText(){
  const st = standings(), n = roundsPlayed(), done = !!room.closed || isFinalRound();
  const who = s => { const e = look(s).emoji; return (e ? e + " " : "") + P(s).name; };
  const tied = st.filter(r => st.length && r.pts === st[0].pts);
  const lead = !st.length ? "no rounds yet" : tied.length > 1
    ? `${tied.map(r => who(r.s)).join(" and ")} ${done ? "tie for the win" : "are level"} on ${st[0].pts}`
    : `${who(st[0].s)} ${done ? "wins" : "leads"} with ${st[0].pts}`;
  const out = [`OutRanked party: ${lead} after ${n} ${n === 1 ? "round" : "rounds"}`];
  st.forEach((r, i) => out.push(`${i + 1}. ${who(r.s)} ${r.pts} (\u2705 ${r.exact}  \u{1F525} ${r.near}  \u2744\uFE0F ${r.cold})`));
  const url = pageUrl();
  out.push("Rank a list, then guess how your friends ranked it." + (url ? " Play: " + url : ""));
  return out.join("\n");
}

// ---- actions ----
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const duelLeave = actions.leave;
Object.assign(actions, {
  partyStart: () => {
    if (!amHost() || active().length < PARTY_MIN) return;
    roomRef.update({started: true, picking: true, order: shuffle(active()), picks: null, size: null, turn: 0, it: null, sit: null, history: null, closed: null, baseTiers: baseTiers()});
  },
  partyPick: btn => {
    const list = chosenList(), t = targetOf(me.slot);
    if (!list) { pickOpen = true; fillSelects(); if (btn) { btn.textContent = "Choose a list first"; setTimeout(() => { btn.textContent = "Use this list"; }, 2000); } return; }
    const tiers = tierNames.map(x => (x || "").trim().slice(0, 14)).filter(Boolean);
    if (tiers.length < 2) { if (btn) { btn.textContent = "Name at least two tiers"; setTimeout(() => { btn.textContent = "Use this list"; }, 2000); } return; }
    roomRef.child("picks/" + t).set({by: me.slot, list, tiers});
  },
  partyNext: () => { if (canAdvance()) { modal = null; partyAdvance(); } },
  partyAgain: () => {
    if (!amHost()) return;
    const u = {started: false, picking: null, order: null, turn: null, it: null, picks: null, history: null, closed: null, size: null, sit: null,
      round: room.round + 1, list: {title: "Party lobby"}, tiers: baseTiers()};
    seatsIn().forEach(s => {
      if (P(s).left) u["players/" + s] = null;              // free the seats of anyone who left
      else ["ready", "own", "guess", "say"].forEach(k => { u["players/" + s + "/" + k] = null; });
    });
    modal = null; roomRef.update(u);
  },
  partySit: () => {
    const u = {};
    participants().filter(s => s !== room.it && !P(s).ready).forEach(s => { u["sit/" + s] = room.round; });
    roomRef.update(u);
  },
  partySkip: () => partyAdvance(),
  partyEnd: () => roomRef.update({closed: {by: me.slot}}),
  handHost: btn => { roomRef.update({host: btn.dataset.s}); modal = null; leave("", true); },
  leave: () => {
    if (!room || room.mode !== "party") return duelLeave();
    const others = active().filter(s => s !== me.slot);
    if (amHost() && others.length >= PARTY_MIN) { modal = {kind: "hostleave"}; renderModal(); return; }
    if (room.started && others.length < PARTY_MIN) roomRef.update({closed: {few: true}});
    else if (amHost() && others.length) roomRef.update({host: others[0]});
    leave("", true);
  }
});

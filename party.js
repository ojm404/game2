/* OutRanked party mode: 3 to 8 players take turns being "it".
   Loaded after the main script in index.html and uses its helpers (room, me, tally, keys, boardView, look, mark, ...).

   A round: "it" ranks the list honestly while everyone else guesses that ranking.
   Guessers score their own points (3 exact, 1 one tier off, 3 per perfect row) and the best guesser gets a bonus.
   "It" scores the group's average, so being easy to read pays. Everyone is "it" once; most points wins.
   The player who was "it" picks the next list. Fewer than 3 players left ends the game. */

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
// Whoever was "it" picks the next list; if they have left, the host does.
const chooser = () => (P(room.it) && !P(room.it).left) ? room.it : room.host;

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
  // Host duties: end the game when fewer than 3 are left, and move on if "it" has left mid-round.
  if (room.started && active().length < PARTY_MIN) { roomRef.update({closed: {few: true}}); return; }
  if (room.started && P(room.it) && P(room.it).left && !roundDone()) partyAdvance(null, null);
}
function partyAdvance(list, tiers){
  const i = nextItIndex();
  if (i < 0) { roomRef.update({closed: {done: true}}); return; }
  const u = {round: room.round + 1, turn: i, it: room.order[i], sit: null};
  if (list) u.list = list;
  if (tiers) u.tiers = tiers;
  seatsIn().forEach(s => { u["players/" + s + "/ready"] = false; u["players/" + s + "/own"] = null; u["players/" + s + "/guess"] = null; });
  roomRef.update(u);
}

// ---- screens ----
let partyResultsRound = null;
function partyStatus(){
  const st = !room.started ? `Party lobby: ${active().length} of ${PARTY_MAX}`
    : `Round ${(room.turn || 0) + 1} of ${(room.order || []).length}. ${tag(room.it)} is it`;
  const chip = s => {
    const p = P(s), on = room.started;
    const state = p.left ? "left" : sitting(s) ? "sitting out" : p.online === false || p.away ? "away"
      : !on ? "" : roundDone() ? "" : p.ready ? "locked in" : s === room.it ? "ranking" : "guessing";
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
    <p class="hint">First up: <strong style="color:var(--text)">${esc(L().title)}</strong>. Share the room code ${esc(me.code)}. A party needs ${PARTY_MIN} to ${PARTY_MAX} players.</p>
    ${amHost()
      ? `<div class="actions">${invite}<button class="btn" data-act="partyStart" ${n >= PARTY_MIN ? "" : "disabled"}>Start the game</button></div>
         ${n < PARTY_MIN ? `<p class="hint" style="margin-top:8px">Waiting for ${PARTY_MIN - n} more ${PARTY_MIN - n === 1 ? "player" : "players"}.</p>` : ""}`
      : `<p class="hint">${hostName} will start the game once everyone is in.</p><div class="actions">${invite}</div>`}</div>`;
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
  if (partyResultsRound !== room.round) {          // fresh next-round choices for whoever picks next
    partyResultsRound = room.round; pickId = null; pickOpen = false;
    tierNames = roomTiers().concat(["", "", "", "", "", ""]).slice(0, 6);
  }
  const sc = roundScores();
  return `<p class="verdict">${tag(room.it)}'s ranking</p>
    <p class="hint">${esc(L().title)}. Under each one: the emoji of everyone who placed it exactly.</p>
    ${partyBoard()}
    <h2 style="margin-top:20px">Leaderboard</h2>${leaderboard(true)}
    <p class="hint">${pname(room.it)} scored ${sc.itScore}, the group's average.${sc.best.length ? ` Best guess: ${sc.best.map(pname).join(" and ")} (+${BEST_BONUS} bonus).` : ""}</p>
    <div class="actions"><button class="btn" data-act="openRound">Open chat and next steps</button><button class="btn ghost" data-act="share">Copy results</button></div>`;
}
function partyDraw(){
  const head = partyStatus();
  if (!room.started) return head + partyLobby();
  if (roundDone()) return head + partyResults();
  if (sitting(me.slot)) return head + `<div class="panel"><h2>Sitting this one out</h2><p class="hint">The round carried on without you. You're back in for the next one.</p></div>`;
  if (me.step !== "locked") { const want = me.slot === room.it ? "own" : "guess"; if (me.step !== want) me.step = want; }
  if (me.step === "locked") return head + partyWaiting();
  return head + boardView(P(room.it).name);
}

// ---- pop-ups ----
function partyUpdateModal(){
  if (room.closed) { modal = {kind: "pclosed"}; return; }
  if (modal && modal.kind === "hostleave") return;
  if (roundDone()) { if (seen.round !== room.round) { seen.round = room.round; modal = {kind: "pround"}; } }
  else if (modal && (modal.kind === "pround" || modal.kind === "say")) modal = null;
  const n = active().filter(s => s !== me.slot).reduce((t, s) => { const sy = P(s).say; return t + (sy && sy.r === room.round ? sy.n : 0); }, 0);
  if (n > seen.say) { seen.say = n; if (!modal) modal = {kind: "say"}; }
}
function partyModalHtml(){
  const says = `<p class="sublabel">Say something</p><div class="says">${SAY.map((t, i) => `<button data-act="say" data-i="${i}">${esc(t)}</button>`).join("")}</div>`;
  const copyBack = `<div class="actions"><button class="btn" data-act="share">Copy results</button><button class="btn ghost" data-act="closedOk">Back to start</button></div>`;
  if (modal.kind === "hostleave") {
    return `<h2>Hand over hosting</h2><p>Pick who runs the room after you leave.</p>
      <div class="says">${active().filter(s => s !== me.slot).map(s => `<button data-act="handHost" data-s="${s}" style="--pc:${pcolor(s)}">${mark(s)}${pname(s)}</button>`).join("")}</div>
      <div class="actions"><button class="btn ghost" data-act="closeModal">Stay in the room</button></div>`;
  }
  if (modal.kind === "pclosed") {
    const c = room.closed, why = c.few ? "Only two players are left, so the game is over." : c.by ? `${pname(c.by)} ended the game.` : "Everyone has had a turn.";
    return `<h2>Final results</h2><p>${why}</p>${roundsPlayed() ? leaderboard(false) : "<p>No rounds were finished.</p>"}${copyBack}`;
  }
  if (modal.kind === "say") return `<button class="x" data-act="closeModal">Close</button><h2>New message</h2>${chatLog()}${says}`;
  // end of a round
  const sc = roundScores(), last = isFinalRound();
  let next;
  if (last) next = `<p>That was the last turn.</p>${copyBack}`;
  else if (chooser() === me.slot) next = `<p><strong style="color:var(--text)">${room.it === me.slot ? "You were it, so you" : "You're the host, so you"} choose the next list.</strong> ${tag(room.order[nextItIndex()])} is it next.</p>
      <div class="picker" role="group" aria-label="Next list"></div>
      ${tierEditor()}
      <div class="actions"><button class="btn" data-act="partyNext">Start next round</button><button class="btn ghost" data-act="share">Copy results</button>${amHost() ? `<button class="btn ghost" data-act="partyEnd">End game</button>` : ""}</div>`;
  else next = `<p>${tag(chooser())} is choosing the next list. ${tag(room.order[nextItIndex()])} is it next.</p>
      <div class="actions"><button class="btn ghost" data-act="share">Copy results</button>${amHost() ? `<button class="btn ghost" data-act="partyEnd">End game</button>` : ""}</div>`;
  return `<button class="x" data-act="closeModal">View the board</button>
    <h2>${last ? "Final results" : `Round ${(room.turn || 0) + 1} results`}</h2>
    <p>${tag(room.it)} was it and scored ${sc.itScore}.${sc.best.length ? ` Best guess: ${sc.best.map(tag).join(" and ")}.` : ""}</p>
    ${leaderboard(true)}
    ${chatLog()}${says}
    <p class="sublabel">${last ? "Game over" : "What next?"}</p>
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
    const order = shuffle(active()), u = {started: true, order, turn: 0, it: order[0], round: room.round + 1, sit: null};
    seatsIn().forEach(s => { u["players/" + s + "/ready"] = false; u["players/" + s + "/own"] = null; u["players/" + s + "/guess"] = null; });
    roomRef.update(u);
  },
  partyNext: btn => {
    const list = chosenList();
    const tiers = tierNames.map(t => (t || "").trim().slice(0, 14)).filter(Boolean);
    const say = msg => { if (btn) { btn.textContent = msg; setTimeout(() => { btn.textContent = "Start next round"; }, 2000); } };
    if (!list) { pickOpen = true; fillSelects(); say("Choose the next list first"); return; }
    if (tiers.length < 2) { say("Name at least two tiers"); return; }
    modal = null; partyAdvance(list, tiers);
  },
  partySit: () => {
    const u = {};
    participants().filter(s => s !== room.it && !P(s).ready).forEach(s => { u["sit/" + s] = room.round; });
    roomRef.update(u);
  },
  partySkip: () => partyAdvance(null, null),
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

// Builds lists.json for Tier Battleship from TMDB.
// Run locally:  TMDB_API_KEY=xxxx node build-lists.js   (Node 18+)
// Works with either a TMDB v3 API key or a v4 read access token.

const fs = require("fs");

/* ======== EDIT THIS: the face-off lists you want ======== */
const DEFS = [
  { type: "actor",      name: "Leonardo Dicaprio" },
  { type: "actor",      name: "Nicolas Cage" },
  { type: "director",   name: "James Cameron" },
  { type: "director",   name: "Ridley Scott" },
  { type: "director",   name: "Christopher Nolan" },
  { type: "director",   name: "Steven Spielberg" },
  { type: "collection", name: "Harry Potter" },
  { type: "collection", name: "Mission: Impossible" },
  { type: "collection", name: "Star Trek" },
  { type: "year",       year: 1999 },
  { type: "year",       year: 2001 },
  // TV, two ways to play: "tv" ranks a show's seasons, "episodes" ranks the episodes inside one season.
  { type: "tv",         name: "Friends" },
  { type: "tv",         name: "Stargate SG-1" },
  { type: "episodes",   name: "Friends", season: 5 },
  { type: "episodes",   name: "Stargate SG-1", season: 1 }
];
const MAX_ITEMS = 12;        // items per list
const MAX_EPISODES = 12;    // long seasons are trimmed to their most-voted episodes
const MIN_ITEMS = 5;         // skip lists that come out shorter than this
const MIN_VOTES = 300;       // drops obscure titles
const EXCLUDE_MARVEL = true; // set false to allow Marvel films
/* ========================================================= */

const KEY = process.env.TMDB_API_KEY;
if (!KEY) { console.error("Set the TMDB_API_KEY environment variable."); process.exit(1); }
const isToken = KEY.length > 40;

async function tmdb(path, params = {}) {
  const url = new URL("https://api.themoviedb.org/3" + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (!isToken) url.searchParams.set("api_key", KEY);
  const res = await fetch(url, isToken ? { headers: { Authorization: "Bearer " + KEY } } : {});
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return res.json();
}

const today = new Date().toISOString().slice(0, 10);
const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const year = d => (d || "").slice(0, 4);
const movieItem = m => ({ id: "m" + m.id, name: m.title, note: year(m.release_date), poster: m.poster_path || null });

async function isMarvel(id) {
  const d = await tmdb(`/movie/${id}`, { append_to_response: "keywords" });
  const names = [...(d.production_companies || []), ...((d.keywords && d.keywords.keywords) || [])].map(x => x.name.toLowerCase());
  return names.some(n => n.includes("marvel")) || /deadpool/i.test(d.title);
}

// Takes candidate movies, keeps the best-known released features, returns them oldest first.
async function pickMovies(candidates, { minVotes = MIN_VOTES } = {}) {
  const seen = new Set();
  const pool = candidates
    .filter(m => m.release_date && m.release_date <= today && !m.video && m.vote_count >= minVotes)
    .filter(m => !(m.genre_ids || []).includes(99))            // no documentaries
    .filter(m => !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => b.vote_count - a.vote_count);
  const out = [];
  for (const m of pool) {
    if (out.length >= MAX_ITEMS) break;
    if (EXCLUDE_MARVEL && await isMarvel(m.id)) continue;
    out.push(m);
  }
  return out.sort((a, b) => a.release_date.localeCompare(b.release_date)).map(movieItem);
}

async function findPerson(name) {
  const r = await tmdb("/search/person", { query: name });
  if (!r.results.length) throw new Error("No person found for " + name);
  return r.results[0];
}

const CATS = { people: "Actors & directors", franchise: "Franchises", year: "Movies by year", tv: "TV" };

const builders = {
  async actor(def) {
    const p = await findPerson(def.name);
    const c = await tmdb(`/person/${p.id}/movie_credits`);
    const leads = c.cast.filter(m => m.order !== undefined && m.order < 8 && !/uncredited|voice|self/i.test(m.character || ""));
    return { cat: CATS.people, title: `${p.name} movies`, items: await pickMovies(leads) };
  },
  async director(def) {
    const p = await findPerson(def.name);
    const c = await tmdb(`/person/${p.id}/movie_credits`);
    return { cat: CATS.people, title: `Films directed by ${p.name}`, items: await pickMovies(c.crew.filter(m => m.job === "Director")) };
  },
  async collection(def) {
    const r = await tmdb("/search/collection", { query: def.name });
    if (!r.results.length) throw new Error("No collection found for " + def.name);
    const c = await tmdb(`/collection/${r.results[0].id}`);
    return { cat: CATS.franchise, title: c.name.replace(/ Collection$/, "") + " films", items: await pickMovies(c.parts, { minVotes: 0 }) };
  },
  async year(def) {
    const pages = await Promise.all([1, 2].map(page => tmdb("/discover/movie", { primary_release_year: def.year, sort_by: "vote_count.desc", page })));
    return { cat: CATS.year, title: `Biggest movies of ${def.year}`, items: await pickMovies(pages.flatMap(p => p.results)) };
  },
  async tv(def) {
    const r = await tmdb("/search/tv", { query: def.name });
    if (!r.results.length) throw new Error("No show found for " + def.name);
    const show = await tmdb(`/tv/${r.results[0].id}`);
    const items = show.seasons
      .filter(s => s.season_number > 0 && s.air_date && s.air_date <= today)
      .slice(0, 16)
      .map(s => ({ id: "s" + s.id, name: s.name, note: year(s.air_date), poster: s.poster_path || show.poster_path || null }));
    return { cat: CATS.tv, title: `${show.name} seasons`, items };
  },
  async episodes(def) {
    const r = await tmdb("/search/tv", { query: def.name });
    if (!r.results.length) throw new Error("No show found for " + def.name);
    const show = r.results[0];
    const season = await tmdb(`/tv/${show.id}/season/${def.season}`);
    const items = season.episodes
      .filter(e => e.air_date && e.air_date <= today)
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, MAX_EPISODES)
      .sort((a, b) => a.episode_number - b.episode_number)
      .map(e => ({ id: "e" + e.id, name: e.name, note: "Episode " + e.episode_number, poster: e.still_path || null, wide: true }));
    return { cat: CATS.tv, title: `${show.name} season ${def.season} episodes`, items };
  }
};

(async () => {
  const lists = [];
  for (const def of DEFS) {
    try {
      const list = await builders[def.type](def);
      if (list.items.length < MIN_ITEMS) { console.warn(`Skipped "${list.title}": only ${list.items.length} items`); continue; }
      lists.push({ id: slug(list.title), ...list });
      console.log(`${list.title}: ${list.items.length} items`);
    } catch (e) {
      console.warn(`Skipped ${def.type} ${def.name || def.year}${def.season ? " season " + def.season : ""}: ${e.message}`);
    }
  }
  if (!lists.length) { console.error("No lists built; lists.json left unchanged."); process.exit(1); }
  fs.writeFileSync("lists.json", JSON.stringify({ generated: today, lists }, null, 1));
  console.log(`Wrote lists.json with ${lists.length} lists.`);
})();
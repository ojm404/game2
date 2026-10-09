// Builds lists.json for OutRanked from TMDB (film and TV) and MusicBrainz (music).
// Run locally:  TMDB_API_KEY=xxxx node build-lists.js   (Node 18+)
// Works with either a TMDB v3 API key or a v4 read access token.

const fs = require("fs");
// years(1990, 2019) makes one "biggest movies of the year" list for every year in that range.
const years = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ type: "year", year: from + i }));

/* ======== EDIT THIS: the face-off lists you want ======== */
const DEFS = [
  { type: "actor",      name: "Leonardo Dicaprio" },
  { type: "actor",      name: "Nicolas Cage" },
  { type: "actor",      name: "Bruce Willis" },
  { type: "actor",      name: "Matt Damon" },
  { type: "director",   name: "James Cameron" },
  { type: "director",   name: "Ridley Scott" },
  { type: "director",   name: "Christopher Nolan" },
  { type: "director",   name: "Steven Spielberg" },
  { type: "director",   name: "Kevin Smith" },
  { type: "collection", name: "Harry Potter" },
  { type: "collection", name: "Mission: Impossible" },
  // TMDB splits Star Trek into three collections, each too short on its own, so "names" merges them into one list.
  { type: "collection", title: "Star Trek films", names: ["Star Trek: The Original Series Collection", "Star Trek: The Next Generation Collection", "Star Trek: Alternate Reality Collection"] },
  { type: "genre",      name: "Science Fiction" },
  { type: "genre",      name: "Horror" },
  { type: "genre",      name: "Comedy" },
  { type: "keyword",    name: "musical", title: "Biggest musical movies" },
  { type: "genre",      name: "Family", title: "Popular kids' movies" },
  { type: "keyword",    name: "biography", title: "Best biopics" },
  ...years(1990, 2019),
  //   "films" is a hand-picked movie list. Each pick is ["Title", release year]; posters are looked up on TMDB.
  { type: "films", cat: "Franchises", title: "Disney princess movies", picks: [
    ["Snow White and the Seven Dwarfs", 1937], ["Cinderella", 1950], ["Sleeping Beauty", 1959], ["The Little Mermaid", 1989],
    ["Beauty and the Beast", 1991], ["Aladdin", 1992], ["Pocahontas", 1995], ["Mulan", 1998], ["The Princess and the Frog", 2009],
    ["Tangled", 2010], ["Brave", 2012], ["Frozen", 2013], ["Moana", 2016], ["Raya and the Last Dragon", 2021] ] },
  { type: "films", cat: "Awards", group: "Best Picture winners", short: "1990s", title: "Best Picture winners: 1990s", picks: [
    ["Dances with Wolves", 1990], ["The Silence of the Lambs", 1991], ["Unforgiven", 1992], ["Schindler's List", 1993],
    ["Forrest Gump", 1994], ["Braveheart", 1995], ["The English Patient", 1996], ["Titanic", 1997],
    ["Shakespeare in Love", 1998], ["American Beauty", 1999] ] },
  { type: "films", cat: "Awards", group: "Best Picture winners", short: "2000s", title: "Best Picture winners: 2000s", picks: [
    ["Gladiator", 2000], ["A Beautiful Mind", 2001], ["Chicago", 2002], ["The Lord of the Rings: The Return of the King", 2003],
    ["Million Dollar Baby", 2004], ["Crash", 2005], ["The Departed", 2006], ["No Country for Old Men", 2007],
    ["Slumdog Millionaire", 2008], ["The Hurt Locker", 2008] ] },
  { type: "films", cat: "Awards", group: "Best Picture winners", short: "2010s", title: "Best Picture winners: 2010s", picks: [
    ["The King's Speech", 2010], ["The Artist", 2011], ["Argo", 2012], ["12 Years a Slave", 2013], ["Birdman", 2014],
    ["Spotlight", 2015], ["Moonlight", 2016], ["The Shape of Water", 2017], ["Green Book", 2018], ["Parasite", 2019] ] },
  // Music (from MusicBrainz, no key needed).
  //   "albums" ranks an artist's studio albums. Add songs: true to also build a song list for every one of those albums.
  //   "tracks" ranks the songs on the albums you name.
  //   Optional on albums: from / to years, e.g. { type: "albums", name: "Bob Dylan", from: 1962, to: 1976 }
  { type: "albums",     name: "Taylor Swift", songs: true },
  { type: "albums",     name: "Sleater-Kinney" },
  { type: "albums",     name: "Metallica" },
  { type: "tracks",     artist: "Lorde", albums: ["Pure Heroine", "Melodrama", "Virgin"] },
  //   "singles" ranks an artist's singles.
  { type: "singles",    name: "Spice Girls" },
  { type: "singles",    name: "One Direction" },
  //   "names" is a hand-picked list of artists to rank. No lookups, so these tiles have no pictures.
  { type: "names", title: "Top K-pop boy groups", short: "K-pop boy groups", picks: [
    "BTS", "EXO", "SEVENTEEN", "Stray Kids", "TOMORROW X TOGETHER", "ENHYPEN", "NCT 127", "NCT DREAM", "ATEEZ",
    "BIGBANG", "SHINee", "GOT7", "MONSTA X", "Super Junior", "TVXQ" ] },
  { type: "names", title: "Top K-pop girl groups", short: "K-pop girl groups", picks: [
    "BLACKPINK", "TWICE", "Girls' Generation", "Red Velvet", "NewJeans", "aespa", "IVE", "LE SSERAFIM", "ITZY",
    "(G)I-DLE", "MAMAMOO", "2NE1", "Wonder Girls", "KARA", "BABYMONSTER" ] },
  { type: "names", title: "Dream Academy contestants", short: "Dream Academy contestants", picks: [
    ["Sophia", "KATSEYE"], ["Lara", "KATSEYE"], ["Yoonchae", "KATSEYE"], ["Megan", "KATSEYE"], ["Daniela", "KATSEYE"], ["Manon", "KATSEYE"],
    "Emily", "Ezrela", "Marquise", "Samara", "Nayoung", "Ua", "Celeste", "Brooklyn", "Karlee", "Iliya", "Mei", "Hinari", "Adéla", "Lexie" ] },
  { type: "names", title: "Top pop solo women", short: "Pop solo women", picks: [
    "Madonna", "Whitney Houston", "Mariah Carey", "Britney Spears", "Beyoncé", "Rihanna", "Lady Gaga", "Katy Perry",
    "Adele", "Taylor Swift", "Ariana Grande", "Dua Lipa", "Billie Eilish", "Olivia Rodrigo", "Sabrina Carpenter" ] },
  //   "curated" is a hand-picked list: MusicBrainz has no popularity data, so "top" lists are chosen here. Edit freely.
  { type: "curated", title: "Top metal albums", short: "Metal", picks: [
    ["Black Sabbath", "Paranoid"], ["Judas Priest", "British Steel"], ["Motörhead", "Ace of Spades"],
    ["Iron Maiden", "The Number of the Beast"], ["Dio", "Holy Diver"], ["Metallica", "Master of Puppets"],
    ["Slayer", "Reign in Blood"], ["Megadeth", "Rust in Peace"], ["Metallica", "Metallica"],
    ["Pantera", "Vulgar Display of Power"], ["Tool", "Ænima"], ["Opeth", "Blackwater Park"],
    ["System of a Down", "Toxicity"], ["Slipknot", "Iowa"], ["Mastodon", "Leviathan"] ] },
  { type: "curated", title: "Top albums of the 1990s", short: "1990s", picks: [
    ["Nirvana", "Nevermind"], ["Pearl Jam", "Ten"], ["Dr. Dre", "The Chronic"], ["R.E.M.", "Automatic for the People"],
    ["The Smashing Pumpkins", "Siamese Dream"], ["Nas", "Illmatic"], ["Green Day", "Dookie"], ["Portishead", "Dummy"],
    ["The Notorious B.I.G.", "Ready to Die"], ["Alanis Morissette", "Jagged Little Pill"],
    ["Oasis", "(What's the Story) Morning Glory?"], ["Fugees", "The Score"], ["Beck", "Odelay"],
    ["Radiohead", "OK Computer"], ["Lauryn Hill", "The Miseducation of Lauryn Hill"] ] },
  { type: "curated", title: "Top albums of the 2000s", short: "2000s", picks: [
    ["Radiohead", "Kid A"], ["OutKast", "Stankonia"], ["Eminem", "The Marshall Mathers LP"], ["Daft Punk", "Discovery"],
    ["The Strokes", "Is This It"], ["Jay-Z", "The Blueprint"], ["Coldplay", "A Rush of Blood to the Head"],
    ["The White Stripes", "Elephant"], ["Yeah Yeah Yeahs", "Fever to Tell"], ["Beyoncé", "Dangerously in Love"],
    ["Kanye West", "The College Dropout"], ["Arcade Fire", "Funeral"], ["Green Day", "American Idiot"],
    ["Amy Winehouse", "Back to Black"], ["LCD Soundsystem", "Sound of Silver"] ] },
  { type: "curated", title: "Top albums of the 2010s", short: "2010s", picks: [
    ["Kanye West", "My Beautiful Dark Twisted Fantasy"], ["Arcade Fire", "The Suburbs"], ["Adele", "21"],
    ["Kendrick Lamar", "good kid, m.A.A.d city"], ["Daft Punk", "Random Access Memories"],
    ["Vampire Weekend", "Modern Vampires of the City"], ["Taylor Swift", "1989"], ["Kendrick Lamar", "To Pimp a Butterfly"],
    ["Tame Impala", "Currents"], ["Beyoncé", "Lemonade"], ["Frank Ocean", "Blonde"], ["Lorde", "Melodrama"],
    ["SZA", "Ctrl"], ["Billie Eilish", "When We All Fall Asleep, Where Do We Go?"], ["Lana Del Rey", "Norman Fucking Rockwell!"] ] },
  { type: "curated", title: "Canadian rock albums", short: "Canadian rock", picks: [
    ["The Guess Who", "American Woman"], ["Neil Young", "Harvest"], ["Rush", "Moving Pictures"], ["Bryan Adams", "Reckless"],
    ["Barenaked Ladies", "Gordon"], ["The Tragically Hip", "Fully Completely"], ["Alanis Morissette", "Jagged Little Pill"],
    ["Our Lady Peace", "Clumsy"], ["Sum 41", "All Killer No Filler"], ["Nickelback", "Silver Side Up"],
    ["Avril Lavigne", "Let Go"], ["Simple Plan", "No Pads, No Helmets...Just Balls"], ["Arcade Fire", "Funeral"],
    ["Billy Talent", "Billy Talent II"], ["Metric", "Fantasies"] ] },
  // TV, two ways to play: "tv" ranks a show's seasons, "episodes" ranks the episodes inside one season.
  { type: "tv",         name: "Friends" },
  { type: "tv",         name: "Stargate SG-1" },
  { type: "tv",         name: "American Horror Story" },
  { type: "tv",         name: "The Office", year: 2005 },          // year = first aired, to get the US show and not the UK one
  { type: "tvgenre",    name: "Sci-Fi & Fantasy", title: "Hit sci-fi TV shows" },
  // seasons can be "all", one number (season: 5), or a few (seasons: [1, 2, 3]). Each season becomes its own list.
  { type: "episodes",   name: "Friends", seasons: "all" },
  { type: "episodes",   name: "Stargate SG-1", seasons: "all" },
  { type: "episodes",   name: "The Office", year: 2005, seasons: "all" }
];
const MAX_ITEMS = 15;        // items per list
const MAX_EPISODES = 27;    // long seasons are trimmed to their most-voted episodes
const MAX_TRACKS = 30;      // songs per album
const MAX_ALBUMS = 20;      // albums per artist; use from / to on the entry to choose an era for bigger catalogues
const MIN_ITEMS = 5;         // skip lists that come out shorter than this
const MIN_VOTES = 300;       // drops obscure titles
const EXCLUDE_MARVEL = true; // set false to allow Marvel films
/* ========================================================= */

// MusicBrainz asks every app to identify itself and to stay under one request per second.
const MB_AGENT = "OutRanked/1.0 ( https://github.com/ojm404/game2 )";

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

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function mb(path, params = {}) {
  await sleep(1100);
  const url = new URL("https://musicbrainz.org/ws/2" + path);
  Object.entries({ ...params, fmt: "json" }).forEach(([k, v]) => url.searchParams.set(k, v));
  // MusicBrainz answers 503 or 429 when it is busy or thinks we are going too fast: wait and try again, up to five times.
  for (let attempt = 1; ; attempt++) {
    let res = null;
    try { res = await fetch(url, { headers: { "User-Agent": MB_AGENT, Accept: "application/json" } }); } catch (e) {}
    if (res && res.ok) return res.json();
    const busy = !res || res.status === 503 || res.status === 429 || res.status >= 500;
    if (!busy || attempt === 5) throw new Error(`MusicBrainz ${res ? res.status : "network error"} on ${path}`);
    await sleep(attempt * 4000);
  }
}
async function findArtist(name) {
  const r = await mb("/artist", { query: `artist:"${name}"`, limit: 5 });
  if (!r.artists || !r.artists.length) throw new Error("No artist found for " + name);
  return r.artists.find(a => a.name.toLowerCase() === name.toLowerCase()) || r.artists[0];
}
// Returns the cover image address if the Cover Art Archive has one for this album, otherwise null.
async function coverUrl(releaseGroupId) {
  const url = `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;
  try { const res = await fetch(url, { method: "HEAD", redirect: "manual" }); return res.status < 400 ? url : null; }
  catch (e) { return null; }
}

// Finds an album (a MusicBrainz "release group") by artist and title.
async function findAlbum(artist, album) {
  const s = await mb("/release-group", { query: `releasegroup:"${album}" AND artist:"${artist}" AND primarytype:album`, limit: 10 });
  const found = s["release-groups"] || [];
  const plain = found.filter(x => !(x["secondary-types"] || []).length);
  const pool = plain.length ? plain : found;
  return pool.find(x => x.title.toLowerCase() === album.toLowerCase()) || pool[0] || null;
}
// Song list for one album, using its earliest official release so later bonus tracks are left out.
async function trackList(g, artistName) {
  const releases = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const r = await mb("/release", { "release-group": g.id, status: "official", limit: 100, offset });
    releases.push(...(r.releases || []));
    if (offset + 100 >= (r["release-count"] || 0)) break;
  }
  const first = releases.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0];
  if (!first) throw new Error(`No official release found for "${g.title}"`);
  const full = await mb(`/release/${first.id}`, { inc: "recordings" });
  const items = (full.media || []).flatMap(m => m.tracks || []).slice(0, MAX_TRACKS)
    .map((t, i) => ({ id: "k" + t.id, name: t.title, note: "Track " + (i + 1) }));
  return { cat: CATS.music, group: artistName, short: `${g.title} songs`, title: `${artistName}: ${g.title} songs`, items };
}

async function findShow(name, firstAired) {
  const r = await tmdb("/search/tv", firstAired ? { query: name, first_air_date_year: firstAired } : { query: name });
  if (!r.results.length) throw new Error("No show found for " + name);
  return r.results.find(s => s.name.toLowerCase() === name.toLowerCase()) || r.results[0];
}

async function isMarvelShow(id) {
  const d = await tmdb(`/tv/${id}`, { append_to_response: "keywords" });
  const names = [...(d.production_companies || []), ...((d.keywords && d.keywords.results) || [])].map(x => x.name.toLowerCase());
  return names.some(n => n.includes("marvel"));
}

const CATS = { music: "Music", people: "Actors & directors", franchise: "Franchises", genre: "Genres", year: "Movies by year", tv: "TV" };

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
    const parts = [];
    let first = null;
    for (const name of [].concat(def.names || def.name)) {
      const r = await tmdb("/search/collection", { query: name });
      if (!r.results.length) { console.warn(`  no collection found for "${name}"`); continue; }
      const c = await tmdb(`/collection/${r.results[0].id}`);
      first = first || c;
      parts.push(...c.parts);
    }
    if (!first) throw new Error("No collection found");
    return { cat: CATS.franchise, title: def.title || first.name.replace(/ Collection$/, "") + " films", items: await pickMovies(parts, { minVotes: 0 }) };
  },
  async year(def) {
    const pages = await Promise.all([1, 2].map(page => tmdb("/discover/movie", { primary_release_year: def.year, sort_by: "vote_count.desc", page })));
    return { cat: CATS.year, group: `${Math.floor(def.year / 10) * 10}s`, short: String(def.year), title: `Biggest movies of ${def.year}`, items: await pickMovies(pages.flatMap(p => p.results)) };
  },
  async genre(def) {
    const all = (await tmdb("/genre/movie/list")).genres;
    const g = all.find(x => x.name.toLowerCase() === def.name.toLowerCase());
    if (!g) throw new Error(`No genre called "${def.name}". Options: ${all.map(x => x.name).join(", ")}`);
    const pages = await Promise.all([1, 2, 3].map(page => tmdb("/discover/movie", { with_genres: g.id, sort_by: "vote_count.desc", page })));
    return { cat: CATS.genre, title: def.title || `Biggest ${g.name.toLowerCase()} movies`, items: await pickMovies(pages.flatMap(p => p.results)) };
  },
  // A hand-picked movie list. Titles are matched on TMDB by name and release year; the Marvel filter is not applied.
  async films(def) {
    const items = [];
    for (const [title, yr] of def.picks) {
      // Search by title, then prefer the best-known result released within a year of the given year.
      const r = await tmdb("/search/movie", { query: title });
      const close = r.results.filter(x => !yr || Math.abs(Number(year(x.release_date)) - yr) <= 1);
      const exact = close.filter(x => x.title.toLowerCase() === title.toLowerCase());
      const m = (exact.length ? exact : close).sort((x, y) => y.vote_count - x.vote_count)[0];
      if (!m) { console.warn(`  no TMDB match for "${title}" (${yr || "any year"}); left out`); continue; }
      items.push(movieItem(m));
    }
    return { cat: def.cat || CATS.franchise, ...(def.group ? { group: def.group, short: def.short || def.title } : {}), title: def.title, items };
  },
  async tv(def) {
    const show = await tmdb(`/tv/${(await findShow(def.name, def.year)).id}`);
    const items = show.seasons
      .filter(s => s.season_number > 0 && s.air_date && s.air_date <= today)
      .slice(0, 16)
      .map(s => ({ id: "s" + s.id, name: s.name, note: year(s.air_date), poster: s.poster_path || show.poster_path || null }));
    return { cat: CATS.tv, title: `${show.name} seasons`, items };
  },
  async episodes(def) {
    const show = await tmdb(`/tv/${(await findShow(def.name, def.year)).id}`);
    const want = def.seasons === "all"
      ? show.seasons.filter(s => s.season_number > 0 && s.air_date && s.air_date <= today).map(s => s.season_number)
      : [].concat(def.seasons || def.season);
    const out = [];
    for (const n of want) {
      const season = await tmdb(`/tv/${show.id}/season/${n}`);
      const items = season.episodes
        .filter(e => e.air_date && e.air_date <= today)
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, MAX_EPISODES)
        .sort((a, b) => a.episode_number - b.episode_number)
        .map(e => ({ id: "e" + e.id, name: e.name, note: "Episode " + e.episode_number, poster: e.still_path || null, wide: true }));
      out.push({ cat: CATS.tv, title: `${show.name} season ${n} episodes`, items });
    }
    return out;
  },
  async albums(def) {
    const artist = await findArtist(def.name);
    const groups = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const base = { artist: artist.id, type: "album", limit: 100, offset };
      let r;
      try { r = await mb("/release-group", { ...base, "release-group-status": "website-default" }); }
      catch (e) { r = await mb("/release-group", base); }
      groups.push(...(r["release-groups"] || []));
      if (offset + 100 >= (r["release-group-count"] || 0)) break;
    }
    const seen = new Set();
    let studio = groups
      .filter(g => g["primary-type"] === "Album" && !(g["secondary-types"] || []).length)   // no live albums, compilations, soundtracks
      .filter(g => g["first-release-date"] && g["first-release-date"] <= today)
      .filter(g => (!def.from || year(g["first-release-date"]) >= String(def.from)) && (!def.to || year(g["first-release-date"]) <= String(def.to)))
      .filter(g => !seen.has(g.title.toLowerCase()) && seen.add(g.title.toLowerCase()))
      .sort((a, b) => a["first-release-date"].localeCompare(b["first-release-date"]));
    if (studio.length > MAX_ALBUMS) {
      console.warn(`${artist.name} has ${studio.length} studio albums; keeping the first ${MAX_ALBUMS}. Add from / to years to choose an era.`);
      studio = studio.slice(0, MAX_ALBUMS);
    }
    const items = [];
    for (const g of studio) items.push({ id: "a" + g.id, name: g.title, note: year(g["first-release-date"]), img: await coverUrl(g.id), sq: true });
    const era = def.from || def.to ? ` (${def.from || ""}-${def.to || ""})` : "";
    const out = [{ cat: CATS.music, group: artist.name, short: "Albums" + era, title: `${artist.name} albums${era}`, items }];
    if (def.songs) for (const g of studio) {
      try { out.push(await trackList(g, artist.name)); }
      catch (e) { console.warn(`Skipped songs for ${g.title}: ${e.message}`); }
    }
    return out;
  },
  async tracks(def) {
    const out = [];
    for (const album of [].concat(def.albums || def.album)) {
      const g = await findAlbum(def.artist, album);
      if (!g) { console.warn(`Skipped ${def.artist} "${album}": album not found`); continue; }
      const artistName = (g["artist-credit"] && g["artist-credit"][0] && g["artist-credit"][0].name) || def.artist;
      try { out.push(await trackList(g, artistName)); }
      catch (e) { console.warn(`Skipped ${def.artist} "${album}": ${e.message}`); }
    }
    return out;
  },
  // An artist's singles, oldest first.
  async singles(def) {
    const artist = await findArtist(def.name);
    const groups = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const base = { artist: artist.id, type: "single", limit: 100, offset };
      let r;
      try { r = await mb("/release-group", { ...base, "release-group-status": "website-default" }); }
      catch (e) { r = await mb("/release-group", base); }
      groups.push(...(r["release-groups"] || []));
      if (offset + 100 >= (r["release-group-count"] || 0)) break;
    }
    const seen = new Set();
    const singles = groups
      .filter(g => g["primary-type"] === "Single" && !(g["secondary-types"] || []).length)
      .filter(g => g["first-release-date"] && g["first-release-date"] <= today)
      .filter(g => (!def.from || year(g["first-release-date"]) >= String(def.from)) && (!def.to || year(g["first-release-date"]) <= String(def.to)))
      .filter(g => !seen.has(g.title.toLowerCase()) && seen.add(g.title.toLowerCase()))
      .sort((a, b) => a["first-release-date"].localeCompare(b["first-release-date"]))
      .slice(0, MAX_TRACKS);
    const items = [];
    for (const g of singles) items.push({ id: "g" + g.id, name: g.title, note: year(g["first-release-date"]), img: await coverUrl(g.id), sq: true });
    return { cat: CATS.music, group: artist.name, short: "Singles", title: `${artist.name} singles`, items };
  },
  // A hand-picked list of names (artists, groups, anything) with no lookups and no pictures.
  async names(def) {
    // A pick is either "Name" or ["Name", "small note shown under it"].
    const items = def.picks.map(p => { const [n, note] = [].concat(p); return { id: "n" + slug(n), name: n, ...(note ? { note } : {}), sq: true }; });
    return { cat: def.cat || CATS.music, group: def.group || "Top artists", short: def.short || def.title, title: def.title, items };
  },
  // A hand-picked list of albums. Each pick is ["Artist", "Album"]; the year and cover are looked up.
  async curated(def) {
    const items = [];
    for (const [artist, album] of def.picks) {
      let g = null;
      try { g = await findAlbum(artist, album); } catch (e) {}
      if (!g) console.warn(`  no MusicBrainz match for ${artist} - ${album}; added without a cover`);
      items.push({
        id: "c" + slug(artist + " " + album), name: album,
        note: artist + (g && g["first-release-date"] ? ", " + year(g["first-release-date"]) : ""),
        img: g ? await coverUrl(g.id) : null, sq: true
      });
    }
    return { cat: CATS.music, group: def.group || "Top albums", short: def.short || def.title, title: def.title, items };
  },
  // Movies tagged with a TMDB keyword, e.g. "musical", "time travel", "heist".
  async keyword(def) {
    const r = await tmdb("/search/keyword", { query: def.name });
    const k = r.results.find(x => x.name.toLowerCase() === def.name.toLowerCase()) || r.results[0];
    if (!k) throw new Error(`No keyword called "${def.name}"`);
    const pages = await Promise.all([1, 2, 3].map(page => tmdb("/discover/movie", { with_keywords: k.id, sort_by: "vote_count.desc", page })));
    return { cat: CATS.genre, title: def.title || `Biggest ${k.name} movies`, items: await pickMovies(pages.flatMap(p => p.results)) };
  },
  // A list of TV shows (not seasons) from one TMDB TV genre.
  async tvgenre(def) {
    const all = (await tmdb("/genre/tv/list")).genres;
    const g = all.find(x => x.name.toLowerCase() === def.name.toLowerCase());
    if (!g) throw new Error(`No TV genre called "${def.name}". Options: ${all.map(x => x.name).join(", ")}`);
    const pages = await Promise.all([1, 2].map(page => tmdb("/discover/tv", { with_genres: g.id, sort_by: "vote_count.desc", page })));
    const out = [];
    for (const s of pages.flatMap(p => p.results)) {
      if (out.length >= MAX_ITEMS) break;
      if (!s.first_air_date || s.first_air_date > today || out.some(x => x.id === s.id)) continue;
      if (EXCLUDE_MARVEL && await isMarvelShow(s.id)) continue;
      out.push(s);
    }
    const items = out.sort((a, b) => a.first_air_date.localeCompare(b.first_air_date))
      .map(s => ({ id: "t" + s.id, name: s.name, note: year(s.first_air_date), poster: s.poster_path || null }));
    return { cat: CATS.tv, title: def.title || `Biggest ${g.name} shows`, items };
  }
};

(async () => {
  // The previous lists.json is kept as a safety net: if a list fails to build this time (a busy server, a network blip),
  // last run's version of it is carried over instead of the list disappearing from the game.
  let previous = [];
  try { previous = JSON.parse(fs.readFileSync("lists.json", "utf8")).lists || []; } catch (e) {}
  const lists = [];
  for (const def of DEFS) {
    const src = JSON.stringify(def);
    const label = `${def.type} ${def.name || def.title || def.artist || def.year}`;
    const built = [];
    try {
      for (const list of [].concat(await builders[def.type](def))) {
        if (list.items.length < MIN_ITEMS) { console.warn(`Skipped "${list.title}": only ${list.items.length} items`); continue; }
        built.push({ id: slug(list.title), src, ...list });
        console.log(`${list.title}: ${list.items.length} items`);
      }
    } catch (e) {
      console.warn(`Failed ${label}: ${e.message}`);
    }
    for (const old of previous.filter(p => p.src === src && !built.some(n => n.id === p.id))) {
      built.push(old);
      console.warn(`Kept last run's "${old.title}" because it did not build this time`);
    }
    lists.push(...built);
  }
  if (!lists.length) { console.error("No lists built; lists.json left unchanged."); process.exit(1); }
  fs.writeFileSync("lists.json", JSON.stringify({ generated: today, lists }, null, 1));
  console.log(`Wrote lists.json with ${lists.length} lists.`);
})();

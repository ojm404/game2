// Builds lists.json for OutRanked from TMDB (film and TV), MusicBrainz (music) and RAWG (video games).
// Run locally:  TMDB_API_KEY=xxxx node build-lists.js   (Node 18+)
// Works with either a TMDB v3 API key or a v4 read access token.

const fs = require("fs");
// years(1990, 2019) makes one "biggest movies of the year" list for every year in that range.
// decades(1980, 2010) makes one "biggest movies of the decade" list for the 1980s, 1990s, 2000s and 2010s.
const decades = (from, to) => Array.from({ length: (to - from) / 10 + 1 }, (_, i) => ({ type: "decade", decade: from + i * 10 }));
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
  { type: "genre",      name: "Comedy", noDisney: true },      // noDisney leaves out Disney films but keeps Pixar
  { type: "keyword",    name: "musical", title: "Biggest musical movies", noDisney: true },
  { type: "genre",      name: "Family", title: "Popular kids' movies", noDisney: true },
  { type: "keyword",    name: "biography", title: "Best biopics" },
  ...decades(1980, 2010),     // listed before the years so "Whole decade" is the first option in each decade's submenu
  ...years(1980, 2019),
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
  // Video games (from RAWG, needs the RAWG_API_KEY secret).
  //   "games" is a hand-picked list. A pick is "Name", or ["Name shown", "what to search for", release year].
  //   "console" is the best-known games on one console. order: "-added" = most popular, "-metacritic" = best reviewed.
  { type: "games", group: "Franchises", title: "The Legend of Zelda games", short: "The Legend of Zelda", picks: [
    ["The Legend of Zelda", "The Legend of Zelda", 1986], ["Zelda II: The Adventure of Link", "Zelda II: The Adventure of Link", 1987],
    ["A Link to the Past", "The Legend of Zelda: A Link to the Past", 1991], ["Link's Awakening", "The Legend of Zelda: Link's Awakening", 1993],
    ["Ocarina of Time", "The Legend of Zelda: Ocarina of Time", 1998], ["Majora's Mask", "The Legend of Zelda: Majora's Mask", 2000],
    ["Oracle of Seasons", "The Legend of Zelda: Oracle of Seasons", 2001], ["Oracle of Ages", "The Legend of Zelda: Oracle of Ages", 2001],
    ["The Wind Waker", "The Legend of Zelda: The Wind Waker", 2002], ["Four Swords Adventures", "The Legend of Zelda: Four Swords Adventures", 2004],
    ["The Minish Cap", "The Legend of Zelda: The Minish Cap", 2004], ["Twilight Princess", "The Legend of Zelda: Twilight Princess", 2006],
    ["Phantom Hourglass", "The Legend of Zelda: Phantom Hourglass", 2007], ["Spirit Tracks", "The Legend of Zelda: Spirit Tracks", 2009],
    ["Skyward Sword", "The Legend of Zelda: Skyward Sword", 2011], ["A Link Between Worlds", "The Legend of Zelda: A Link Between Worlds", 2013],
    ["Tri Force Heroes", "The Legend of Zelda: Tri Force Heroes", 2015], ["Breath of the Wild", "The Legend of Zelda: Breath of the Wild", 2017],
    ["Tears of the Kingdom", "The Legend of Zelda: Tears of the Kingdom", 2023], ["Echoes of Wisdom", "The Legend of Zelda: Echoes of Wisdom", 2024] ] },
  { type: "games", group: "Franchises", title: "Final Fantasy numbered games", short: "Final Fantasy (numbered)", picks: [
    ["Final Fantasy", "Final Fantasy", 1987], ["Final Fantasy II", "Final Fantasy II", 1988], ["Final Fantasy III", "Final Fantasy III", 1990],
    ["Final Fantasy IV", "Final Fantasy IV", 1991], ["Final Fantasy V", "Final Fantasy V", 1992], ["Final Fantasy VI", "Final Fantasy VI", 1994],
    ["Final Fantasy VII", "Final Fantasy VII", 1997], ["Final Fantasy VIII", "Final Fantasy VIII", 1999], ["Final Fantasy IX", "Final Fantasy IX", 2000],
    ["Final Fantasy X", "Final Fantasy X", 2001], ["Final Fantasy XI", "Final Fantasy XI", 2002], ["Final Fantasy XII", "Final Fantasy XII", 2006],
    ["Final Fantasy XIII", "Final Fantasy XIII", 2009], ["Final Fantasy XIV", "Final Fantasy XIV Online", 2013],
    ["Final Fantasy XV", "Final Fantasy XV", 2016], ["Final Fantasy XVI", "Final Fantasy XVI", 2023] ] },
  { type: "games", group: "Franchises", title: "Kingdom Hearts games", short: "Kingdom Hearts", picks: [
    ["Kingdom Hearts", "Kingdom Hearts", 2002], ["Chain of Memories", "Kingdom Hearts: Chain of Memories", 2004],
    ["Kingdom Hearts II", "Kingdom Hearts II", 2005], ["358/2 Days", "Kingdom Hearts 358/2 Days", 2009],
    ["Birth by Sleep", "Kingdom Hearts Birth by Sleep", 2010], ["Re:coded", "Kingdom Hearts Re:coded", 2010],
    ["Dream Drop Distance", "Kingdom Hearts 3D: Dream Drop Distance", 2012], ["Kingdom Hearts III", "Kingdom Hearts III", 2019],
    ["Melody of Memory", "Kingdom Hearts: Melody of Memory", 2020] ] },
  { type: "games", group: "Franchises", title: "Pokémon generations", short: "Pokémon generations", picks: [
    ["Gen 1: Red, Blue & Yellow", "Pokémon Red", 1996], ["Gen 2: Gold, Silver & Crystal", "Pokémon Gold", 1999],
    ["Gen 3: Ruby, Sapphire & Emerald", "Pokémon Ruby", 2002], ["Gen 4: Diamond, Pearl & Platinum", "Pokémon Diamond", 2006],
    ["Gen 5: Black & White", "Pokémon Black", 2010], ["Gen 6: X & Y", "Pokémon X", 2013], ["Gen 7: Sun & Moon", "Pokémon Sun", 2016],
    ["Gen 8: Sword & Shield", "Pokémon Sword", 2019], ["Gen 9: Scarlet & Violet", "Pokémon Scarlet", 2022] ] },
  { type: "games", group: "Franchises", title: "Call of Duty games", short: "Call of Duty", picks: [
    ["Call of Duty", "Call of Duty", 2003], ["Call of Duty 2", "Call of Duty 2", 2005], ["Call of Duty 3", "Call of Duty 3", 2006],
    ["Call of Duty 4: Modern Warfare", "Call of Duty 4: Modern Warfare", 2007], ["World at War", "Call of Duty: World at War", 2008],
    ["Modern Warfare 2 (2009)", "Call of Duty: Modern Warfare 2", 2009], ["Black Ops", "Call of Duty: Black Ops", 2010],
    ["Modern Warfare 3 (2011)", "Call of Duty: Modern Warfare 3", 2011], ["Black Ops II", "Call of Duty: Black Ops II", 2012],
    ["Ghosts", "Call of Duty: Ghosts", 2013], ["Advanced Warfare", "Call of Duty: Advanced Warfare", 2014],
    ["Black Ops III", "Call of Duty: Black Ops III", 2015], ["Infinite Warfare", "Call of Duty: Infinite Warfare", 2016],
    ["WWII", "Call of Duty: WWII", 2017], ["Black Ops 4", "Call of Duty: Black Ops 4", 2018],
    ["Modern Warfare (2019)", "Call of Duty: Modern Warfare", 2019], ["Black Ops Cold War", "Call of Duty: Black Ops Cold War", 2020],
    ["Vanguard", "Call of Duty: Vanguard", 2021], ["Modern Warfare II (2022)", "Call of Duty: Modern Warfare II", 2022],
    ["Modern Warfare III (2023)", "Call of Duty: Modern Warfare III", 2023], ["Black Ops 6", "Call of Duty: Black Ops 6", 2024],
    ["Black Ops 7", "Call of Duty: Black Ops 7", 2025] ] },
  { type: "games", group: "Genres", title: "Cosy games", short: "Cosy games", picks: [
    "Stardew Valley", "Animal Crossing: New Horizons", "A Short Hike", "Unpacking", "Spiritfarer", "Slime Rancher", "Cozy Grove",
    "Dorfromantik", "Disney Dreamlight Valley", "My Time at Portia", "Coffee Talk", "PowerWash Simulator", "Ooblets",
    "Dave the Diver", "Littlewood" ] },
  { type: "games", group: "Genres", title: "First-person shooters", short: "First-person shooters", picks: [
    ["DOOM (1993)", "DOOM", 1993], ["GoldenEye 007", "GoldenEye 007", 1997], ["Half-Life", "Half-Life", 1998],
    ["Counter-Strike", "Counter-Strike", 2000], ["Halo: Combat Evolved", "Halo: Combat Evolved", 2001], ["Half-Life 2", "Half-Life 2", 2004],
    ["Call of Duty 4: Modern Warfare", "Call of Duty 4: Modern Warfare", 2007], ["BioShock", "BioShock", 2007], ["Halo 3", "Halo 3", 2007],
    ["Left 4 Dead 2", "Left 4 Dead 2", 2009], ["Borderlands 2", "Borderlands 2", 2012], ["Overwatch", "Overwatch", 2016],
    ["DOOM (2016)", "DOOM", 2016], ["Titanfall 2", "Titanfall 2", 2016], ["Destiny 2", "Destiny 2", 2017] ] },
  { type: "games", group: "Genres", title: "Two-player fighting games", short: "Two-player fighting games", picks: [
    ["Street Fighter II", "Street Fighter II", 1991], ["Mortal Kombat II", "Mortal Kombat II", 1993], ["Killer Instinct", "Killer Instinct", 1994],
    ["Tekken 3", "Tekken 3", 1997], ["Street Fighter III: 3rd Strike", "Street Fighter III: 3rd Strike", 1999],
    ["Super Smash Bros. Melee", "Super Smash Bros. Melee", 2001], ["Soulcalibur II", "Soulcalibur II", 2002],
    ["Street Fighter IV", "Street Fighter IV", 2008], ["Injustice 2", "Injustice 2", 2017], ["Tekken 7", "Tekken 7", 2015],
    ["Dragon Ball FighterZ", "Dragon Ball FighterZ", 2018], ["Super Smash Bros. Ultimate", "Super Smash Bros. Ultimate", 2018],
    ["Mortal Kombat 11", "Mortal Kombat 11", 2019], ["Guilty Gear -Strive-", "Guilty Gear -Strive-", 2021], ["Street Fighter 6", "Street Fighter 6", 2023] ] },
  { type: "games", group: "Genres", title: "MMORPGs", short: "MMORPGs", picks: [
    "Ultima Online", "EverQuest", "RuneScape", "EVE Online", "Lineage II", "World of Warcraft", "Guild Wars 2", "MapleStory",
    "Star Wars: The Old Republic", "The Elder Scrolls Online", "Final Fantasy XIV Online", "Black Desert Online", "Lost Ark",
    "New World", "Old School RuneScape" ] },
  { type: "console", name: "Nintendo 64", title: "Best Nintendo 64 games" },
  { type: "console", name: "SNES", title: "Best Super Nintendo games" },
  { type: "console", name: "Nintendo Switch", title: "Best Nintendo Switch games", order: "-metacritic" },
  { type: "games", group: "Awards", title: "The Game Awards: Game of the Year winners", short: "Game of the Year winners", picks: [
    ["Dragon Age: Inquisition", "Dragon Age: Inquisition", 2014], ["The Witcher 3: Wild Hunt", "The Witcher 3: Wild Hunt", 2015],
    ["Overwatch", "Overwatch", 2016], ["Breath of the Wild", "The Legend of Zelda: Breath of the Wild", 2017],
    ["God of War", "God of War", 2018], ["Sekiro: Shadows Die Twice", "Sekiro: Shadows Die Twice", 2019],
    ["The Last of Us Part II", "The Last of Us Part II", 2020], ["It Takes Two", "It Takes Two", 2021], ["Elden Ring", "Elden Ring", 2022],
    ["Baldur's Gate 3", "Baldur's Gate 3", 2023], ["Astro Bot", "Astro Bot", 2024],
    ["Clair Obscur: Expedition 33", "Clair Obscur: Expedition 33", 2025] ] },
  //   "cast" ranks a show's main characters (the ones in the most episodes). Optional count: 8 for a smaller list.
  { type: "cast",       name: "Stargate SG-1" },
  { type: "cast",       name: "Grey's Anatomy" },
  { type: "cast",       name: "The Office", year: 2005 },
  { type: "cast",       name: "Friends" },
  // seasons can be "all", one number (season: 5), or a few (seasons: [1, 2, 3]). Each season becomes its own list.
  { type: "episodes",   name: "Friends", seasons: "all" },
  { type: "episodes",   name: "Stargate SG-1", seasons: "all" },
  { type: "episodes",   name: "The Office", year: 2005, seasons: "all" }
];
const MAX_ITEMS = 15;        // items per list
const MAX_EPISODES = 27;    // long seasons are trimmed to their most-voted episodes
const MAX_CAST = 12;        // characters per "main characters" list
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

// Looks up one movie's studios and keywords to see whether it is a Marvel film or a Disney (but not Pixar) film.
async function studioFlags(id) {
  const d = await tmdb(`/movie/${id}`, { append_to_response: "keywords" });
  const studios = (d.production_companies || []).map(x => x.name.toLowerCase());
  const words = ((d.keywords && d.keywords.keywords) || []).map(x => x.name.toLowerCase());
  return {
    marvel: [...studios, ...words].some(n => n.includes("marvel")) || /deadpool/i.test(d.title),
    // Pixar films also list Disney as a studio, so anything with Pixar on it is kept.
    disney: studios.some(n => n.includes("disney")) && !studios.some(n => n.includes("pixar")),
    franchise: d.belongs_to_collection ? d.belongs_to_collection.id : null
  };
}

// Takes candidate movies, keeps the best-known released features, returns them oldest first.
// noDisney: true also leaves out Disney films, but keeps Pixar (used on lists where Disney would otherwise crowd everything out).
// oneFranchise: true keeps only the best-known film from any one franchise (TMDB collection).
async function pickMovies(candidates, { minVotes = MIN_VOTES, noDisney = false, oneFranchise = false } = {}) {
  const franchises = new Set();
  const seen = new Set();
  const pool = candidates
    .filter(m => m.release_date && m.release_date <= today && !m.video && m.vote_count >= minVotes)
    .filter(m => !(m.genre_ids || []).includes(99))            // no documentaries
    .filter(m => !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => b.vote_count - a.vote_count);
  const out = [];
  for (const m of pool) {
    if (out.length >= MAX_ITEMS) break;
    if (EXCLUDE_MARVEL || noDisney || oneFranchise) {
      const f = await studioFlags(m.id);
      if ((EXCLUDE_MARVEL && f.marvel) || (noDisney && f.disney)) continue;
      if (oneFranchise && f.franchise) {
        if (franchises.has(f.franchise)) continue;    // a bigger film from this franchise is already in
        franchises.add(f.franchise);
      }
    }
    out.push(m);
  }
  return out.sort((a, b) => a.release_date.localeCompare(b.release_date)).map(movieItem);
}

async function findPerson(name) {
  const r = await tmdb("/search/person", { query: name });
  if (!r.results.length) throw new Error("No person found for " + name);
  return r.results[0];
}

// ---- RAWG (video games) ----
const RAWG_KEY = process.env.RAWG_API_KEY;
async function rawg(path, params = {}) {
  if (!RAWG_KEY) throw new Error("the RAWG_API_KEY secret is not set");
  const url = new URL("https://api.rawg.io/api" + path);
  Object.entries({ ...params, key: RAWG_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RAWG ${res.status} on ${path}`);
  return res.json();
}
// RAWG's artwork is very large, so "img" asks its image server for a small crop and "img2" keeps the original as a fallback.
function gameItem(g, name, note) {
  const art = g.background_image || null;
  return { id: "v" + g.id, name: name || g.name, note: note || year(g.released),
    ...(art ? { img: art.replace("/media/games/", "/media/crop/600/400/games/").replace("/media/screenshots/", "/media/crop/600/400/screenshots/"), img2: art } : {}),
    wide: true };
}
const plain = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Finds one game by name. With a year, only a game released within a year of it is accepted, so remakes are not picked by mistake.
async function findGame(query, yr) {
  const r = await rawg("/games", { search: query, search_precise: "true", page_size: 10 });
  const res = r.results || [];
  const near = res.filter(g => !yr || (g.released && Math.abs(Number(year(g.released)) - yr) <= 1));
  return near.find(g => plain(g.name) === plain(query)) || near[0] || null;
}
let rawgPlatforms = null;
async function findPlatform(name) {
  if (!rawgPlatforms) {
    rawgPlatforms = [];
    for (const page of [1, 2]) {
      const r = await rawg("/platforms", { page_size: 40, page });
      rawgPlatforms.push(...(r.results || []));
      if (!r.next) break;
    }
  }
  const p = rawgPlatforms.find(x => plain(x.name) === plain(name));
  if (!p) throw new Error(`No console called "${name}". Options: ${rawgPlatforms.map(x => x.name).join(", ")}`);
  return p;
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
// Bonus material that is not really a song on the album: voice memos, commentary, demos, remixes and the like.
// Only matches inside brackets or after a dash, e.g. "I Know Places (voice memo)", so normal titles are safe.
const NOT_A_SONG = /(?:[(\[]|\s[\u2013\u2014-]\s)[^)\]]*\b(voice memos?|voice notes?|commentary|interview|track by track|demo|karaoke|instrumental|remix|acoustic|live)\b/i;
// Song list for one album, using its earliest official release so later bonus tracks are left out.
async function trackList(g, artistName) {
  const releases = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const r = await mb("/release", { "release-group": g.id, status: "official", inc: "media", limit: 100, offset });
    releases.push(...(r.releases || []));
    if (offset + 100 >= (r["release-count"] || 0)) break;
  }
  // Earliest release first; when several came out the same day (standard and deluxe), take the one with the fewest tracks.
  const size = r => (r.media || []).reduce((n, m) => n + (m["track-count"] || 0), 0) || 999;
  const first = releases.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || size(a) - size(b))[0];
  if (!first) throw new Error(`No official release found for "${g.title}"`);
  const full = await mb(`/release/${first.id}`, { inc: "recordings" });
  const items = (full.media || []).flatMap(m => m.tracks || []).filter(t => !NOT_A_SONG.test(t.title)).slice(0, MAX_TRACKS)
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

const CATS = { games: "Games", music: "Music", people: "Actors & directors", franchise: "Franchises", genre: "Genres", year: "Movies by year", tv: "TV" };

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
  async decade(def) {
    const range = { "primary_release_date.gte": `${def.decade}-01-01`, "primary_release_date.lte": `${def.decade + 9}-12-31` };
    const pages = await Promise.all([1, 2, 3, 4, 5].map(page => tmdb("/discover/movie", { ...range, sort_by: "vote_count.desc", page })));
    return { cat: CATS.year, group: `${def.decade}s`, short: "Whole decade", title: `Biggest movies of the ${def.decade}s`, items: await pickMovies(pages.flatMap(p => p.results), { oneFranchise: true }) };
  },
  async year(def) {
    const pages = await Promise.all([1, 2].map(page => tmdb("/discover/movie", { primary_release_year: def.year, sort_by: "vote_count.desc", page })));
    return { cat: CATS.year, group: `${Math.floor(def.year / 10) * 10}s`, short: String(def.year), title: `Biggest movies of ${def.year}`, items: await pickMovies(pages.flatMap(p => p.results)) };
  },
  async genre(def) {
    const all = (await tmdb("/genre/movie/list")).genres;
    const g = all.find(x => x.name.toLowerCase() === def.name.toLowerCase());
    if (!g) throw new Error(`No genre called "${def.name}". Options: ${all.map(x => x.name).join(", ")}`);
    const pages = await Promise.all((def.noDisney ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map(page => tmdb("/discover/movie", { with_genres: g.id, sort_by: "vote_count.desc", page })));
    return { cat: CATS.genre, title: def.title || `Biggest ${g.name.toLowerCase()} movies`, items: await pickMovies(pages.flatMap(p => p.results), { noDisney: !!def.noDisney }) };
  },
  // A hand-picked list of video games; artwork and years are looked up on RAWG.
  async games(def) {
    const items = [];
    for (const pick of def.picks) {
      const [name, query, yr] = [].concat(pick);
      const g = await findGame(query || name, yr);
      if (g) items.push(gameItem(g, name, yr ? String(yr) : undefined));
      else { console.warn(`  no RAWG match for "${query || name}"${yr ? " (" + yr + ")" : ""}; added without artwork`); items.push({ id: "v" + slug(name), name, ...(yr ? { note: String(yr) } : {}), wide: true }); }
    }
    return { cat: CATS.games, ...(def.group ? { group: def.group, short: def.short || def.title } : {}), title: def.title, items };
  },
  // The best-known games on one console.
  async console(def) {
    const p = await findPlatform(def.name);
    const pages = [];
    for (const page of [1, 2]) pages.push(await rawg("/games", { platforms: p.id, ordering: def.order || "-added", page_size: 40, page }));
    const seen = new Set();
    const items = pages.flatMap(r => r.results || [])
      .filter(g => g.released && g.released <= today && !seen.has(plain(g.name)) && seen.add(plain(g.name)))
      .slice(0, MAX_ITEMS)
      .sort((a, b) => a.released.localeCompare(b.released))
      .map(g => gameItem(g));
    return { cat: CATS.games, group: "Consoles", short: def.title || p.name, title: def.title || `Best ${p.name} games`, items };
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
  // A show's main characters, ranked list of the ones who appear in the most episodes. Tiles show the actor's photo.
  async cast(def) {
    const show = await findShow(def.name, def.year);
    const credits = await tmdb(`/tv/${show.id}/aggregate_credits`);
    const seen = new Set();
    const items = (credits.cast || [])
      .sort((a, b) => b.total_episode_count - a.total_episode_count)
      .map(p => ({ p, character: ((p.roles || [])[0] || {}).character || "" }))
      .filter(x => x.character && !/\b(self|voice|uncredited)\b/i.test(x.character))
      .filter(x => !seen.has(x.character.toLowerCase()) && seen.add(x.character.toLowerCase()))
      .slice(0, def.count || MAX_CAST)
      .map(x => ({ id: "p" + x.p.id, name: x.character, note: x.p.name, poster: x.p.profile_path || null }));
    return { cat: CATS.tv, group: show.name, short: "Main characters", title: `${show.name} main characters`, items };
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
    const pages = await Promise.all((def.noDisney ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map(page => tmdb("/discover/movie", { with_keywords: k.id, sort_by: "vote_count.desc", page })));
    return { cat: CATS.genre, title: def.title || `Biggest ${k.name} movies`, items: await pickMovies(pages.flatMap(p => p.results), { noDisney: !!def.noDisney }) };
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
    const label = `${def.type} ${def.name || def.title || def.artist || def.year || def.decade}`;
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

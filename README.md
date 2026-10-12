# OutRanked

A two-player tier list game. Both players rank the same list in secret, then guess how the other one ranked it. The best guesser wins.

Play it at **[outranked.games](https://outranked.games)**.

## How a game works

1. One player creates a room: picks a name, colour and emoji, chooses what to rank, and optionally renames the tiers (S to F by default).
2. They send the 4-letter room code, or the invite link, to the other player, who joins with their own name, colour and emoji.
3. Each player ranks the list their own way, then predicts the other player's ranking. Nothing is revealed until both have locked in.
4. Results appear side by side for every tier, with a marker under each guess:
   - ✅ exact tier: 3 points
   - 🔥 one tier off: 1 point (with ⬆️ or ⬇️ showing where the real answer was)
   - ❄️ two or more tiers off: 0 points
   - A whole tier row guessed perfectly: 3 bonus points
5. An end-of-round pop-up shows the scores and room totals, has quick chat messages, and offers **Play another round**, **Copy results** or **End game**. When one player asks for another round, the other agrees, and the winner chooses the next list and can rename the tiers.
6. A tie goes to sudden death: one player secretly picks their favourite of two items they put in the same tier, and the other has to guess it.

## What's in this repo

| Path | What it is |
|---|---|
| `index.html` | The whole game: one page, no build step. Served by GitHub Pages. |
| `build-lists.js` | Script that builds every rankable list and writes `lists.json`. |
| `lists.json` | The generated lists. Don't edit by hand; the script overwrites it. |
| `.github/workflows/build-lists.yml` | Runs the script every Monday at 06:00 UTC (and on demand), then commits `lists.json`. |
| `images/` | Your own pictures for list items (see [Adding your own pictures](#adding-your-own-pictures)). |

## Setup

### 1. Firebase (game rooms)

Rooms, moves and chat sync through a Firebase Realtime Database.

1. Create a Firebase project and add a Realtime Database.
2. In the database's **Rules** tab, publish:

   ```json
   { "rules": { "rooms": { "$code": { ".read": true, ".write": true } } } }
   ```

3. Copy your web app's `firebaseConfig` into the `firebaseConfig` block near the top of the script in `index.html`.

The Firebase web config is meant to be public, so it's fine in the page. What protects the data is the rules above. Anyone with a room code can read or write that room, which is fine for a casual game.

### 2. API keys (list data)

Add these as repository secrets under **Settings > Secrets and variables > Actions**:

| Secret | Used for | Where to get it |
|---|---|---|
| `TMDB_API_KEY` | Movies and TV | [themoviedb.org](https://www.themoviedb.org/settings/api) (v3 key or v4 read token) |
| `RAWG_API_KEY` | Video games | [rawg.io/apidocs](https://rawg.io/apidocs) |

Music (MusicBrainz) and books (Open Library) need no key.

### 3. Hosting

1. Turn on GitHub Pages: **Settings > Pages**, deploy from branch `main`, folder `/ (root)`.
2. In `index.html`, set `SITE_URL` to the game's public address (currently `https://outranked.games`). It's used in invite links and copied results.
3. `LISTS_URL` points at the raw `lists.json` on GitHub, which updates within minutes of each build.

### 4. Embedding on another site (GoDaddy)

Paste this into an HTML block. It passes room codes through from invite links and resizes the frame to fit the game, so players only scroll the page, not the frame:

```html
<iframe id="outranked" title="OutRanked"
        style="width:100%;height:900px;border:0;display:block"
        allow="clipboard-write"></iframe>
<script>
(function () {
  var base = "https://ojm404.github.io/game2/";
  var frame = document.getElementById("outranked");
  var query = "";
  try { query = window.top.location.search; } catch (e) {}
  if (!query) { try { query = new URL(document.referrer).search; } catch (e) {} }
  var room = new URLSearchParams(query).get("room");
  frame.src = base + (room ? "?room=" + encodeURIComponent(room) : "");
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://ojm404.github.io") return;
    if (!e.data || e.data.type !== "outranked:height") return;
    frame.style.height = Math.max(600, e.data.height) + "px";
    frame.setAttribute("scrolling", "no");
  });
})();
</script>
```

If the host's HTML section has a fixed height setting, clear it so the frame can grow.

## Building the lists

- **Automatically:** every Monday via GitHub Actions.
- **On demand:** **Actions > Build face-off lists > Run workflow**.
- **Locally:** `TMDB_API_KEY=xxxx RAWG_API_KEY=xxxx node build-lists.js` (Node 18 or newer).

A full build takes around 10 minutes, mostly because MusicBrainz allows one request per second.

If a list fails to build (a busy server, a network blip), the script keeps last run's version of it instead of dropping it. Check the run log for these lines:

- `Failed …` or `Skipped …`: a list that didn't build, and why.
- `no … match for …`: an item that couldn't be looked up, usually a search title that needs adjusting.
- `… without a picture. To add your own, upload: …`: the exact image file names to use.

## Adding or changing lists

Every list is one entry in the `DEFS` block at the top of `build-lists.js`. Edit it, commit, and run the workflow.

### List types

**Movies and TV (TMDB)**

| Type | Example | Notes |
|---|---|---|
| `actor` | `{ type: "actor", name: "Meryl Streep" }` | Their best-known films as a lead. |
| `director` | `{ type: "director", name: "Quentin Tarantino" }` | |
| `collection` | `{ type: "collection", name: "Harry Potter" }` | A TMDB franchise. `names: [...]` merges several; `max: 30` raises the limit. |
| `genre` | `{ type: "genre", name: "Horror", noSequels: true }` | `and: "Comedy"` requires both genres. |
| `keyword` | `{ type: "keyword", name: "vampire", oneFranchise: true }` | `and: "…"` requires both keywords. |
| `films` | `{ type: "films", title: "…", picks: [["Titanic", 1997]] }` | Hand-picked films, posters looked up. |
| `years(1980, 2019)` / `decades(1980, 2010)` | inside `DEFS` with `...` | Biggest films per year or per decade (one per franchise for decades). |
| `tv` | `{ type: "tv", name: "Friends" }` | Ranks seasons. |
| `episodes` | `{ type: "episodes", name: "Friends", seasons: "all" }` | One list per season, or `seasons: [1, 5]`. |
| `cast` | `{ type: "cast", name: "Bridgerton", perSeason: 8 }` | Main characters by episode count. `exclude`, `count`, `photos: false`. |
| `filmcast` | `{ type: "filmcast", collection: "The Twilight Saga" }` | Main characters of a film or a whole franchise. |
| `tvgenre` | `{ type: "tvgenre", name: "Sci-Fi & Fantasy" }` | Ranks whole shows. |
| `people` | `{ type: "people", title: "…", picks: [["Daniel Craig", "2006 to 2021"]] }` | Real people with photos. `["Character", "note", "Actor"]` shows a character with the actor's photo. |

Filters for film lists: `noDisney` (keeps Pixar), `noSequels` (first film of each franchise only), `oneFranchise` (one film per franchise). Marvel is excluded everywhere while `EXCLUDE_MARVEL` is `true`.

For shows that share a title with another show, add `year` (the year it first aired), e.g. `{ type: "tv", name: "The Office", year: 2005 }` for the US version.

**Music (MusicBrainz)**

| Type | Example | Notes |
|---|---|---|
| `albums` | `{ type: "albums", name: "Metallica" }` | Studio albums only. `songs: true` adds a song list per album; `from` / `to` limit the years. |
| `tracks` | `{ type: "tracks", artist: "Lorde", albums: ["Melodrama"] }` | Songs on the named albums, original track list, bonus material removed. |
| `singles` | `{ type: "singles", name: "Spice Girls" }` | |
| `curated` | `{ type: "curated", title: "…", picks: [["Nirvana", "Nevermind"]] }` | Hand-picked albums, covers looked up. |

**Books (Open Library)**

| Type | Example | Notes |
|---|---|---|
| `books` | `{ type: "books", title: "…", picks: [["Dune", "Frank Herbert"]] }` | `["Series name", "Author", "First book title"]` shows a series with its first cover. Add a year (number) to show it on the tile. |
| `authors` | `{ type: "authors", title: "…", picks: ["Margaret Atwood"] }` | With author photos where available. |

**Games (RAWG)**

| Type | Example | Notes |
|---|---|---|
| `games` | `{ type: "games", title: "…", picks: [["Halo 3", "Halo 3", 2007]] }` | `["Name shown", "Search name", year]`. |
| `console` | `{ type: "console", name: "Nintendo 64", since: 1996, oneSeries: true }` | `since` keeps games original to the console; `oneSeries` drops sequels. |

**Anything else**

| Type | Example | Notes |
|---|---|---|
| `names` | `{ type: "names", cat: "Misc", group: "Food", title: "…", picks: ["Pepperoni", ["Big Mac", "McDonald's"]] }` | Plain name tiles. `["Name", "note"]` adds a small line underneath. |

### Where a list appears in the menu

The menu is grouped as category, then submenus:

| Category | Submenus |
|---|---|
| Movies | Franchises, Genres, Actors, Directors, By year, Awards, Characters |
| TV | One per show or universe, plus Show rankings |
| Music | One per artist, plus Top albums and Top artists |
| Books | Popular, Genres, Romance, Young adult, Authors |
| Games | Franchises, Genres, Consoles, Awards |
| Misc | Food, Perfumes |

Most list types place themselves. To put a list somewhere specific, add `menu` and, optionally, `short` (its label inside the submenu). Use ` > ` for deeper levels:

```js
{ type: "collection", name: "James Bond", menu: "Movies > Franchises > James Bond", short: "Films" }
```

`group` and `short` also work on their own, e.g. `group: "Whedonverse"` to collect several shows' lists into one submenu.

### Limits

Set near the top of `build-lists.js`:

| Setting | Default | Controls |
|---|---|---|
| `MAX_ITEMS` | 15 | Films, games and most automatic lists |
| `MAX_EPISODES` | 27 | Episodes per season |
| `MAX_TRACKS` | 30 | Songs per album, singles per artist |
| `MAX_ALBUMS` | 20 | Albums per artist |
| `MAX_CAST` | 12 | Characters per cast list |
| `MIN_ITEMS` | 5 | Lists shorter than this are skipped |

## Adding your own pictures

Any item can use your own image. Upload it to:

```
images/<list name>/<item name>.jpg
```

Both names are lower case with dashes, e.g. `images/favourite-niche-perfumes/warm-bulb.jpg`. The build log prints the exact file name for every item still missing a picture, so you can copy it from there. jpg, png and webp all work. Your file replaces any picture the item already had.

For best results:

- **Shape:** portrait (about 2:3); square for music lists.
- **Size:** 400 to 600 pixels on the long side.
- **Rights:** use your own photos, or images you have permission to use.

## Checking which version is live

The page footer shows a build stamp such as `Build 2026-10-13.2`. If a change doesn't appear, compare that stamp: phones and GitHub Pages can serve a cached copy for a few minutes after an update.

## Credits

- Movie and TV data from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.
- Music data from [MusicBrainz](https://musicbrainz.org); cover art from the [Cover Art Archive](https://coverartarchive.org).
- Game data and artwork from [RAWG](https://rawg.io).
- Book data and covers from [Open Library](https://openlibrary.org).

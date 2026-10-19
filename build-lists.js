// Builds lists.json for OutRanked from TMDB (film and TV), MusicBrainz (music), RAWG (video games) and Open Library (books).
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
  { type: "actor",      name: "Meryl Streep" },
  { type: "actor",      name: "Anne Hathaway", billing: 5 },      // billing: 5 = only films where she is in the top five billed
  { type: "director",   name: "James Cameron" },
  { type: "director",   name: "Ridley Scott" },
  { type: "director",   name: "Christopher Nolan" },
  { type: "director",   name: "Steven Spielberg" },
  { type: "director",   name: "Kevin Smith" },
  { type: "director",   name: "Quentin Tarantino" },
  { type: "collection", name: "Harry Potter" },
  { type: "collection", name: "Mission: Impossible" },
  { type: "collection", name: "The Fast and the Furious", title: "Fast & Furious films" },
  //   menu sets exactly where a list appears: "Category > Submenu > Sub-submenu". short is its label there.
  { type: "collection", name: "James Bond", title: "James Bond films", max: 30, menu: "Movies > Franchises > James Bond", short: "Films" },      // max raises the usual 15-film limit
  { type: "films", cat: "Franchises", title: "Studio Ghibli films", short: "Studio Ghibli", picks: [
    ["Nausicaä of the Valley of the Wind", 1984, 81], ["Castle in the Sky", 1986], ["My Neighbor Totoro", 1988], ["Grave of the Fireflies", 1988],
    ["Kiki's Delivery Service", 1989], ["Only Yesterday", 1991], ["Porco Rosso", 1992], ["Ocean Waves", 1993], ["Pom Poko", 1994],
    ["Whisper of the Heart", 1995], ["Princess Mononoke", 1997], ["My Neighbors the Yamadas", 1999], ["Spirited Away", 2001],
    ["The Cat Returns", 2002], ["Howl's Moving Castle", 2004], ["Tales from Earthsea", 2006], ["Ponyo", 2008], ["Arrietty", 2010],
    ["From Up on Poppy Hill", 2011], ["The Wind Rises", 2013], ["The Tale of the Princess Kaguya", 2013], ["When Marnie Was There", 2014],
    ["Earwig and the Witch", 2020], ["The Boy and the Heron", 2023] ] },
  // Only the second film of each series.
  { type: "films", cat: "Franchises", title: "Sequels and part 2s", short: "Sequels and part 2s", picks: [
    ["The Godfather Part II", 1974], ["The Empire Strikes Back", 1980], ["Mad Max 2", 1981], ["Indiana Jones and the Temple of Doom", 1984],
    ["Aliens", 1986], ["Back to the Future Part II", 1989], ["Terminator 2: Judgment Day", 1991], ["Toy Story 2", 1999],
    ["Harry Potter and the Chamber of Secrets", 2002], ["The Lord of the Rings: The Two Towers", 2002], ["Shrek 2", 2004],
    ["Kill Bill: Vol. 2", 2004], ["Before Sunset", 2004], ["The Dark Knight", 2008], ["The Twilight Saga: New Moon", 2009],
    ["The Hunger Games: Catching Fire", 2013], ["Paddington 2", 2017], ["Blade Runner 2049", 2017], ["Top Gun: Maverick", 2022],
    ["Dune: Part Two", 2024], ["Inside Out 2", 2024], ["Wicked: For Good", 2025] ] },
  // Remakes of earlier films (the year is the remake's).
  { type: "films", cat: "Franchises", title: "Movie remakes", short: "Remakes", picks: [
    ["The Magnificent Seven", 1960], ["The Thing", 1982], ["Scarface", 1983], ["The Fly", 1986], ["Little Shop of Horrors", 1986],
    ["Cape Fear", 1991], ["Scent of a Woman", 1992], ["Ocean's Eleven", 2001], ["The Ring", 2002], ["Insomnia", 2002], ["The Italian Job", 2003],
    ["The Departed", 2006], ["True Grit", 2010], ["The Girl with the Dragon Tattoo", 2011], ["A Star Is Born", 2018], ["West Side Story", 2021],
    ["Nosferatu", 2024] ] },
  { type: "films", cat: "Franchises", title: "Planet of the Apes films", picks: [
    ["Planet of the Apes", 1968], ["Beneath the Planet of the Apes", 1970], ["Escape from the Planet of the Apes", 1971],
    ["Conquest of the Planet of the Apes", 1972], ["Battle for the Planet of the Apes", 1973], ["Planet of the Apes", 2001],
    ["Rise of the Planet of the Apes", 2011], ["Dawn of the Planet of the Apes", 2014], ["War for the Planet of the Apes", 2017],
    ["Kingdom of the Planet of the Apes", 2024] ] },
  // TMDB splits Star Trek into three collections, each too short on its own, so "names" merges them into one list.
  { type: "collection", title: "Star Trek films", names: ["Star Trek: The Original Series Collection", "Star Trek: The Next Generation Collection", "Star Trek: Alternate Reality Collection"] },
  { type: "genre",      name: "Science Fiction" },
  { type: "genre",      name: "Horror", noSequels: true },       // noSequels keeps only the first film of any franchise
  { type: "genre",      name: "Romance", title: "Biggest romance movies" },
  { type: "genre",      name: "Romance", and: "Comedy", title: "Biggest rom-coms" },   // "and" = must be in both genres
  { type: "keyword",    name: "period drama", title: "Period pieces" },
  { type: "keyword",    name: "vampire", title: "Vampire movies", oneFranchise: true },
  { type: "genre",      name: "Comedy", noDisney: true },      // noDisney leaves out Disney films but keeps Pixar
  { type: "keyword",    name: "musical", title: "Biggest musical movies", noDisney: true },
  { type: "genre",      name: "Family", title: "Popular kids' movies", noDisney: true },
  // Biopics must carry both TMDB keywords, "biography" and "based on true story", which weeds out loosely tagged films.
  { type: "keyword",    name: "biography", and: "based on true story", title: "Biopics (true stories)" },
  //   "filmcast" ranks the main characters of one film (use the first film of a franchise).
  //   With "collection", characters are ranked by how big their role is across every film in the franchise.
  // Hand-picked: the automatic franchise lookup matched a different "Twilight". Actor shown under each name, with their photo.
  { type: "people", menu: "Movies > Characters", title: "Twilight main characters", picks: [
    ["Bella Swan", "Kristen Stewart", "Kristen Stewart"], ["Edward Cullen", "Robert Pattinson", "Robert Pattinson"],
    ["Jacob Black", "Taylor Lautner", "Taylor Lautner"], ["Charlie Swan", "Billy Burke", "Billy Burke"],
    ["Alice Cullen", "Ashley Greene", "Ashley Greene"], ["Jasper Hale", "Jackson Rathbone", "Jackson Rathbone"],
    ["Rosalie Hale", "Nikki Reed", "Nikki Reed"], ["Emmett Cullen", "Kellan Lutz", "Kellan Lutz"],
    ["Carlisle Cullen", "Peter Facinelli", "Peter Facinelli"], ["Esme Cullen", "Elizabeth Reaser", "Elizabeth Reaser"],
    ["Victoria", "Rachelle Lefevre / Bryce Dallas Howard", "Rachelle Lefevre"], ["Aro", "Michael Sheen", "Michael Sheen"],
    ["Jessica Stanley", "Anna Kendrick", "Anna Kendrick"], ["Renesmee Cullen", "Mackenzie Foy", "Mackenzie Foy"] ] },
  //   "people" is a hand-picked list of real people with their TMDB photos. A pick is "Name" or ["Name", "note"].
  { type: "people", title: "Actors who played James Bond", menu: "Movies > Franchises > James Bond", short: "Actors who played Bond", picks: [
    ["Sean Connery", "1962 to 1971, and 1983"], ["George Lazenby", "1969"], ["Roger Moore", "1973 to 1985"],
    ["Timothy Dalton", "1987 to 1989"], ["Pierce Brosnan", "1995 to 2002"], ["Daniel Craig", "2006 to 2021"] ] },
  { type: "people", title: "Actors who played Batman", menu: "Movies > Characters", picks: [
    ["Adam West", "1966"], ["Michael Keaton", "1989 to 1992, and 2023"], ["Val Kilmer", "1995"], ["George Clooney", "1997"],
    ["Christian Bale", "2005 to 2012"], ["Ben Affleck", "2016 to 2023"], ["Will Arnett", "The LEGO Batman Movie, 2017"], ["Robert Pattinson", "2022"] ] },
  { type: "names", cat: "Movies", group: "Characters", title: "Vampire characters (film and TV)", picks: [
    ["Count Dracula", "Dracula"], ["Count Orlok", "Nosferatu"], ["Lestat de Lioncourt", "Interview with the Vampire"],
    ["Louis de Pointe du Lac", "Interview with the Vampire"], ["David", "The Lost Boys"], ["Spike", "Buffy the Vampire Slayer"],
    ["Angel", "Buffy the Vampire Slayer"], ["Selene", "Underworld"], ["Edward Cullen", "Twilight"], ["Alice Cullen", "Twilight"],
    ["Eric Northman", "True Blood"], ["Bill Compton", "True Blood"], ["Damon Salvatore", "The Vampire Diaries"],
    ["Klaus Mikaelson", "The Vampire Diaries"], ["Eli", "Let the Right One In"], ["Nandor the Relentless", "What We Do in the Shadows"],
    ["Nadja", "What We Do in the Shadows"], ["Mavis", "Hotel Transylvania"], ["Alucard", "Castlevania"], ["Count von Count", "Sesame Street"] ] },
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
  { type: "albums",     name: "Linkin Park" },
  { type: "albums",     name: "Michael Jackson" },
  { type: "albums",     name: "Black Sabbath" },
  { type: "albums",     name: "Gorillaz" },
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
  { type: "names", group: "Taylor Swift", title: "Taylor Swift track 5 songs", short: "Track 5 songs", picks: [
    ["Cold As You", "Taylor Swift"], ["White Horse", "Fearless"], ["Dear John", "Speak Now"], ["All Too Well", "Red"],
    ["All You Had to Do Was Stay", "1989"], ["Delicate", "reputation"], ["The Archer", "Lover"], ["my tears ricochet", "folklore"],
    ["tolerate it", "evermore"], ["You're On Your Own, Kid", "Midnights"], ["So Long, London", "The Tortured Poets Department"],
    ["Eldest Daughter", "The Life of a Showgirl"] ] },
  // Singles that were radio hits or got their own music video, hand-picked, oldest first, with release year.
  { type: "names", group: "Taylor Swift", title: "Taylor Swift singles and videos", short: "Singles and videos", picks: [
    ["Tim McGraw", "2006"], ["Teardrops on My Guitar", "2007"], ["Our Song", "2007"], ["Picture to Burn", "2008"], ["Love Story", "2008"],
    ["White Horse", "2008"], ["You Belong with Me", "2009"], ["Fifteen", "2009"], ["Mine", "2010"], ["Back to December", "2010"],
    ["Mean", "2011"], ["The Story of Us", "2011"], ["Ours", "2011"], ["We Are Never Ever Getting Back Together", "2012"],
    ["I Knew You Were Trouble", "2012"], ["22", "2013"], ["Everything Has Changed", "2013"], ["Shake It Off", "2014"], ["Blank Space", "2014"],
    ["Style", "2015"], ["Bad Blood", "2015"], ["Wildest Dreams", "2015"], ["Out of the Woods", "2016"], ["Look What You Made Me Do", "2017"],
    ["...Ready for It?", "2017"], ["End Game", "2018"], ["Delicate", "2018"], ["ME!", "2019"], ["You Need to Calm Down", "2019"], ["Lover", "2019"],
    ["The Man", "2020"], ["Cardigan", "2020"], ["Willow", "2020"], ["Anti-Hero", "2022"], ["Bejeweled", "2022"], ["Lavender Haze", "2023"],
    ["Cruel Summer", "2023"], ["Fortnight", "2024"], ["The Fate of Ophelia", "2025"] ] },
  { type: "names", group: "Ariana Grande", title: "Ariana Grande singles and videos", short: "Singles and videos", picks: [
    ["The Way", "2013"], ["Baby I", "2013"], ["Right There", "2013"], ["Problem", "2014"], ["Break Free", "2014"], ["Bang Bang", "2014"],
    ["Love Me Harder", "2014"], ["Santa Tell Me", "2014"], ["One Last Time", "2015"], ["Focus", "2015"], ["Dangerous Woman", "2016"],
    ["Into You", "2016"], ["Side to Side", "2016"], ["No Tears Left to Cry", "2018"], ["God Is a Woman", "2018"], ["Breathin", "2018"],
    ["Thank U, Next", "2018"], ["7 Rings", "2019"], ["Break Up with Your Girlfriend, I'm Bored", "2019"], ["Boyfriend", "2019"],
    ["Rain on Me", "2020"], ["Stuck with U", "2020"], ["Positions", "2020"], ["34+35", "2020"], ["POV", "2021"], ["Yes, And?", "2024"],
    ["We Can't Be Friends", "2024"], ["The Boy Is Mine", "2024"] ] },
  { type: "names", group: "Billy Talent", title: "Billy Talent singles and videos", short: "Singles and videos", picks: [
    ["Try Honesty", "2003"], ["The Ex", "2004"], ["River Below", "2004"], ["This Is How It Goes", "2004"], ["Nothing to Lose", "2004"],
    ["Devil in a Midnight Mass", "2006"], ["Red Flag", "2006"], ["Fallen Leaves", "2006"], ["Surrender", "2007"], ["Rusted from the Rain", "2009"],
    ["Devil on My Shoulder", "2009"], ["Saint Veronika", "2010"], ["Diamond on a Landmine", "2010"], ["Viking Death March", "2012"],
    ["Surprise Surprise", "2012"], ["Stand Up and Run", "2012"], ["Afraid of Heights", "2016"], ["Louder Than the DJ", "2016"], ["Big Red Gun", "2016"],
    ["Forgiveness I + II", "2020"], ["I Beg to Differ (This Will Get Better)", "2022"] ] },
  { type: "names", group: "Linkin Park", title: "Linkin Park singles and videos", short: "Singles and videos", picks: [
    ["One Step Closer", "2000"], ["Crawling", "2001"], ["Papercut", "2001"], ["In the End", "2001"], ["Pts.OF.Athrty", "2002"],
    ["Somewhere I Belong", "2003"], ["Faint", "2003"], ["Numb", "2003"], ["Breaking the Habit", "2004"], ["From the Inside", "2004"],
    ["What I've Done", "2007"], ["Bleed It Out", "2007"], ["Shadow of the Day", "2007"], ["Leave Out All the Rest", "2008"], ["New Divide", "2009"],
    ["The Catalyst", "2010"], ["Waiting for the End", "2010"], ["Iridescent", "2011"], ["Burn It Down", "2012"], ["Lost in the Echo", "2012"],
    ["Castle of Glass", "2013"], ["Final Masquerade", "2014"], ["Heavy", "2017"], ["Talking to Myself", "2017"], ["One More Light", "2017"],
    ["Lost", "2023"], ["The Emptiness Machine", "2024"], ["Heavy Is the Crown", "2024"], ["Over Each Other", "2024"], ["Two Faced", "2025"] ] },
  { type: "names", group: "Michael Jackson", title: "Michael Jackson singles", short: "Singles", picks: [
    ["Got to Be There", "1971"], ["Rockin' Robin", "1972"], ["Ben", "1972"], ["Don't Stop 'Til You Get Enough", "1979"], ["Rock with You", "1979"],
    ["Off the Wall", "1980"], ["She's Out of My Life", "1980"], ["The Girl Is Mine", "1982"], ["Billie Jean", "1983"], ["Beat It", "1983"],
    ["Wanna Be Startin' Somethin'", "1983"], ["Human Nature", "1983"], ["Thriller", "1983"], ["I Just Can't Stop Loving You", "1987"],
    ["Bad", "1987"], ["The Way You Make Me Feel", "1987"], ["Man in the Mirror", "1988"], ["Dirty Diana", "1988"], ["Smooth Criminal", "1988"],
    ["Leave Me Alone", "1989"], ["Black or White", "1991"], ["Remember the Time", "1992"], ["In the Closet", "1992"], ["Jam", "1992"],
    ["Heal the World", "1992"], ["Scream", "1995"], ["You Are Not Alone", "1995"], ["Earth Song", "1995"], ["They Don't Care About Us", "1996"],
    ["You Rock My World", "2001"] ] },
  { type: "names", group: "Black Sabbath", title: "Black Sabbath singles", short: "Singles", picks: [
    ["Evil Woman", "1970"], ["Paranoid", "1970"], ["Iron Man", "1971"], ["Tomorrow's Dream", "1972"], ["Sabbath Bloody Sabbath", "1973"],
    ["Am I Going Insane (Radio)", "1976"], ["Never Say Die", "1978"], ["Hard Road", "1978"], ["Neon Knights", "1980"], ["Die Young", "1980"],
    ["The Mob Rules", "1981"], ["Turn Up the Night", "1982"], ["Trashed", "1983"], ["Headless Cross", "1989"], ["God Is Dead?", "2013"] ] },
  { type: "names", title: "Top pop boy groups", short: "Pop boy groups", picks: [
    "The Osmonds", "The Jackson 5", "Menudo", "New Edition", "New Kids on the Block", "Boyz II Men", "Take That", "Boyzone",
    "Backstreet Boys", "*NSYNC", "98 Degrees", "Westlife", "Jonas Brothers", "One Direction", "The Wanted" ] },
  { type: "names", title: "Top pop girl groups", short: "Pop girl groups", picks: [
    "The Supremes", "The Ronettes", "Bananarama", "The Go-Go's", "The Bangles", "En Vogue", "TLC", "Spice Girls", "All Saints",
    "Destiny's Child", "Sugababes", "Girls Aloud", "The Pussycat Dolls", "Fifth Harmony", "Little Mix" ] },
  { type: "names", group: "Gorillaz", title: "Gorillaz singles", short: "Singles", picks: [
    ["Clint Eastwood", "2001"], ["19-2000", "2001"], ["Rock the House", "2001"], ["Tomorrow Comes Today", "2002"],
    ["Feel Good Inc.", "2005"], ["Dare", "2005"], ["Dirty Harry", "2005"], ["Kids with Guns", "2006"], ["El Mañana", "2006"],
    ["Stylo", "2010"], ["Superfast Jellyfish", "2010"], ["On Melancholy Hill", "2010"], ["Doncamatic", "2010"], ["Saturnz Barz", "2017"],
    ["Andromeda", "2017"], ["Humility", "2018"], ["Tranz", "2018"], ["Momentary Bliss", "2020"], ["New Gold", "2022"],
    ["Silent Running", "2023"] ] },
  // Album of the Year winners grouped by the decade of the ceremony (the 1980s list runs from the 1980 to the 1989 Grammys).
  { type: "curated", group: "Grammy Album of the Year", title: "Grammy Album of the Year: 1980s", short: "1980s ceremonies", picks: [
    ["Billy Joel", "52nd Street"], ["Christopher Cross", "Christopher Cross"], ["John Lennon", "Double Fantasy"], ["Toto", "Toto IV"],
    ["Michael Jackson", "Thriller"], ["Lionel Richie", "Can't Slow Down"], ["Phil Collins", "No Jacket Required"],
    ["Paul Simon", "Graceland"], ["U2", "The Joshua Tree"], ["George Michael", "Faith"] ] },
  { type: "curated", group: "Grammy Album of the Year", title: "Grammy Album of the Year: 1990s", short: "1990s ceremonies", picks: [
    ["Bonnie Raitt", "Nick of Time"], ["Quincy Jones", "Back on the Block"], ["Natalie Cole", "Unforgettable... with Love"],
    ["Eric Clapton", "Unplugged"], ["Whitney Houston", "The Bodyguard"], ["Tony Bennett", "MTV Unplugged"],
    ["Alanis Morissette", "Jagged Little Pill"], ["Celine Dion", "Falling into You"], ["Bob Dylan", "Time Out of Mind"],
    ["Lauryn Hill", "The Miseducation of Lauryn Hill"] ] },
  { type: "curated", group: "Grammy Album of the Year", title: "Grammy Album of the Year: 2000s", short: "2000s ceremonies", picks: [
    ["Santana", "Supernatural"], ["Steely Dan", "Two Against Nature"], ["Various Artists", "O Brother, Where Art Thou?"],
    ["Norah Jones", "Come Away with Me"], ["OutKast", "Speakerboxxx/The Love Below"], ["Ray Charles", "Genius Loves Company"],
    ["U2", "How to Dismantle an Atomic Bomb"], ["Dixie Chicks", "Taking the Long Way"], ["Herbie Hancock", "River: The Joni Letters"],
    ["Robert Plant & Alison Krauss", "Raising Sand"] ] },
  { type: "curated", group: "Grammy Album of the Year", title: "Grammy Album of the Year: 2010s", short: "2010s ceremonies", picks: [
    ["Taylor Swift", "Fearless"], ["Arcade Fire", "The Suburbs"], ["Adele", "21"], ["Mumford & Sons", "Babel"],
    ["Daft Punk", "Random Access Memories"], ["Beck", "Morning Phase"], ["Taylor Swift", "1989"], ["Adele", "25"],
    ["Bruno Mars", "24K Magic"], ["Kacey Musgraves", "Golden Hour"] ] },
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
  { type: "curated", title: "Top R&B albums", short: "R&B", picks: [
    ["Marvin Gaye", "What's Going On"], ["Stevie Wonder", "Songs in the Key of Life"], ["Janet Jackson", "Rhythm Nation 1814"],
    ["Mary J. Blige", "My Life"], ["TLC", "CrazySexyCool"], ["Erykah Badu", "Baduizm"], ["Brandy", "Never Say Never"],
    ["Lauryn Hill", "The Miseducation of Lauryn Hill"], ["D'Angelo", "Voodoo"], ["Aaliyah", "Aaliyah"], ["Alicia Keys", "Songs in A Minor"],
    ["Usher", "Confessions"], ["Frank Ocean", "Channel Orange"], ["Beyoncé", "Lemonade"], ["SZA", "Ctrl"] ] },
  { type: "curated", title: "Top rap albums", short: "Rap", picks: [
    ["Run-D.M.C.", "Raising Hell"], ["Public Enemy", "It Takes a Nation of Millions to Hold Us Back"], ["N.W.A", "Straight Outta Compton"],
    ["A Tribe Called Quest", "The Low End Theory"], ["Dr. Dre", "The Chronic"], ["Wu-Tang Clan", "Enter the Wu-Tang (36 Chambers)"],
    ["Nas", "Illmatic"], ["The Notorious B.I.G.", "Ready to Die"], ["2Pac", "All Eyez on Me"], ["Missy Elliott", "Supa Dupa Fly"],
    ["OutKast", "Aquemini"], ["Eminem", "The Marshall Mathers LP"], ["Jay-Z", "The Blueprint"],
    ["Kanye West", "My Beautiful Dark Twisted Fantasy"], ["Kendrick Lamar", "good kid, m.A.A.d city"] ] },
  { type: "curated", title: "Top pop albums", short: "Pop", picks: [
    ["Michael Jackson", "Thriller"], ["Janet Jackson", "Control"], ["Madonna", "Like a Prayer"], ["Spice Girls", "Spice"],
    ["Britney Spears", "...Baby One More Time"], ["Backstreet Boys", "Millennium"], ["Kelly Clarkson", "Breakaway"], ["Lady Gaga", "The Fame"],
    ["Katy Perry", "Teenage Dream"], ["Adele", "21"], ["Taylor Swift", "1989"], ["Ariana Grande", "Thank U, Next"],
    ["Dua Lipa", "Future Nostalgia"], ["Olivia Rodrigo", "Sour"], ["Sabrina Carpenter", "Short n' Sweet"] ] },
  { type: "curated", title: "Top rock albums", short: "Rock", picks: [
    ["The Beatles", "Sgt. Pepper's Lonely Hearts Club Band"], ["The Who", "Who's Next"], ["Led Zeppelin", "Led Zeppelin IV"],
    ["The Rolling Stones", "Exile on Main St."], ["Pink Floyd", "The Dark Side of the Moon"], ["Queen", "A Night at the Opera"],
    ["Bruce Springsteen", "Born to Run"], ["Fleetwood Mac", "Rumours"], ["AC/DC", "Back in Black"], ["U2", "The Joshua Tree"],
    ["Guns N' Roses", "Appetite for Destruction"], ["Nirvana", "Nevermind"], ["Radiohead", "OK Computer"],
    ["Foo Fighters", "The Colour and the Shape"], ["Green Day", "American Idiot"] ] },
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
  //   lang limits a TV genre list to shows first made in that language ("ja" = Japanese).
  { type: "tvgenre",    name: "Animation", lang: "ja", perFranchise: 1, menu: "TV > Anime", title: "Top anime series", short: "Top anime series" },
  //   "shows" is a hand-picked list of TV shows with posters. A pick is ["Name shown", "Search name", first year].
  { type: "shows", menu: "TV > Anime", title: "Magical girl anime", short: "Magical girl", picks: [
    ["Creamy Mami", "Magical Angel Creamy Mami", 1983], ["Sailor Moon", "Sailor Moon", 1992], ["Magic Knight Rayearth", "Magic Knight Rayearth", 1994],
    ["Wedding Peach", "Wedding Peach", 1995], ["Revolutionary Girl Utena", "Revolutionary Girl Utena", 1997], ["Cardcaptor Sakura", "Cardcaptor Sakura", 1998],
    ["Ojamajo Doremi", "Magical DoReMi", 1999], ["Princess Tutu", "Princess Tutu", 2002], ["Tokyo Mew Mew", "Tokyo Mew Mew", 2002],
    ["Pretty Cure", "Futari wa Pretty Cure", 2004], ["Magical Girl Lyrical Nanoha", "Magical Girl Lyrical Nanoha", 2004],
    ["Shugo Chara!", "Shugo Chara!", 2007], ["Puella Magi Madoka Magica", "Puella Magi Madoka Magica", 2011],
    ["Symphogear", "Symphogear", 2012], ["Little Witch Academia", "Little Witch Academia", 2017] ] },
  // Anime characters: hand-picked name tiles (TMDB credits anime by voice actor, which would show the wrong photos).
  { type: "names", cat: "TV", menu: "TV > Anime > Characters", title: "One Piece main characters", short: "One Piece", picks: [
    "Monkey D. Luffy", "Roronoa Zoro", "Nami", "Usopp", "Sanji", "Tony Tony Chopper", "Nico Robin", "Franky", "Brook", "Jinbe",
    "Nefertari Vivi", "Portgas D. Ace", "Sabo", "Shanks", "Trafalgar Law" ] },
  { type: "names", cat: "TV", menu: "TV > Anime > Characters", title: "Sailor Moon characters", short: "Sailor Moon", picks: [
    ["Sailor Moon", "Usagi Tsukino"], ["Sailor Mercury", "Ami Mizuno"], ["Sailor Mars", "Rei Hino"], ["Sailor Jupiter", "Makoto Kino"],
    ["Sailor Venus", "Minako Aino"], ["Tuxedo Mask", "Mamoru Chiba"], ["Sailor Chibi Moon", "Chibiusa"], ["Sailor Pluto", "Setsuna Meioh"],
    ["Sailor Uranus", "Haruka Tenoh"], ["Sailor Neptune", "Michiru Kaioh"], ["Sailor Saturn", "Hotaru Tomoe"], ["Luna", "Usagi's cat"],
    ["Artemis", "Minako's cat"], ["Queen Beryl", "Dark Kingdom"] ] },
  { type: "names", cat: "TV", menu: "TV > Anime > Characters", title: "Dragon Ball Z characters", short: "Dragon Ball Z", picks: [
    "Goku", "Vegeta", "Gohan", "Piccolo", "Krillin", "Future Trunks", "Goten", "Bulma", "Chi-Chi", "Master Roshi", "Yamcha", "Tien",
    "Android 18", "Frieza", "Cell", "Majin Buu" ] },
  { type: "names", cat: "TV", menu: "TV > Anime > Characters", title: "Anime villains", short: "Villains (two per series at most)", picks: [
    ["Frieza", "Dragon Ball Z"], ["Cell", "Dragon Ball Z"], ["Orochimaru", "Naruto"], ["Madara Uchiha", "Naruto"],
    ["Sosuke Aizen", "Bleach"], ["Dio Brando", "JoJo's Bizarre Adventure"], ["Hisoka", "Hunter x Hunter"], ["Meruem", "Hunter x Hunter"],
    ["Johan Liebert", "Monster"], ["Griffith", "Berserk"], ["Father", "Fullmetal Alchemist: Brotherhood"], ["Light Yagami", "Death Note"],
    ["Shogo Makishima", "Psycho-Pass"], ["Donquixote Doflamingo", "One Piece"], ["Muzan Kibutsuji", "Demon Slayer"],
    ["Ryomen Sukuna", "Jujutsu Kaisen"], ["All For One", "My Hero Academia"], ["Queen Beryl", "Sailor Moon"] ] },
  { type: "shows", menu: "TV > Anime", title: "Slice of life anime", short: "Slice of life", picks: [
    ["Azumanga Daioh", "Azumanga Daioh", 2002], ["Aria the Animation", "Aria the Animation", 2005], ["Lucky Star", "Lucky Star", 2007],
    ["Natsume's Book of Friends", "Natsume's Book of Friends", 2008], ["K-On!", "K-On!", 2009], ["Nichijou", "Nichijou", 2011],
    ["Usagi Drop", "Bunny Drop", 2011], ["Hyouka", "Hyouka", 2012], ["Silver Spoon", "Silver Spoon", 2013], ["Non Non Biyori", "Non Non Biyori", 2013],
    ["Barakamon", "Barakamon", 2014], ["Shirobako", "Shirobako", 2014], ["March Comes in Like a Lion", "March Comes in Like a Lion", 2016],
    ["Laid-Back Camp", "Laid-Back Camp", 2018], ["Bocchi the Rock!", "Bocchi the Rock!", 2022] ] },
  { type: "shows", menu: "TV > Anime", title: "Horror anime", short: "Horror", picks: [
    ["Hellsing", "Hellsing", 2001], ["Elfen Lied", "Elfen Lied", 2004], ["Hell Girl", "Hell Girl", 2005], ["Higurashi: When They Cry", "Higurashi: When They Cry", 2006],
    ["Mononoke", "Mononoke", 2007], ["Shiki", "Shiki", 2010], ["Another", "Another", 2012], ["Yamishibai", "Yamishibai: Japanese Ghost Stories", 2013],
    ["Parasyte -the maxim-", "Parasyte -the maxim-", 2014], ["Tokyo Ghoul", "Tokyo Ghoul", 2014], ["Devilman Crybaby", "Devilman Crybaby", 2018],
    ["Junji Ito Collection", "Junji Ito Collection", 2018], ["The Promised Neverland", "The Promised Neverland", 2019],
    ["Mieruko-chan", "Mieruko-chan", 2021], ["Chainsaw Man", "Chainsaw Man", 2022] ] },
  { type: "shows", menu: "TV > Anime", title: "Romance anime", short: "Romance", picks: [
    ["Ouran High School Host Club", "Ouran High School Host Club", 2006], ["Nana", "Nana", 2006], ["Lovely Complex", "Lovely Complex", 2007],
    ["Clannad", "Clannad", 2007], ["Toradora!", "Toradora!", 2008], ["Kimi ni Todoke", "Kimi ni Todoke: From Me to You", 2009],
    ["Maid Sama!", "Maid Sama!", 2010], ["Your Lie in April", "Your Lie in April", 2014], ["My Love Story!!", "My Love Story!!", 2015],
    ["Wotakoi", "Wotakoi: Love Is Hard for Otaku", 2018], ["Rascal Does Not Dream of Bunny Girl Senpai", "Rascal Does Not Dream of Bunny Girl Senpai", 2018],
    ["Fruits Basket", "Fruits Basket", 2019], ["Kaguya-sama: Love Is War", "Kaguya-sama: Love Is War", 2019], ["Horimiya", "Horimiya", 2021],
    ["Skip and Loafer", "Skip and Loafer", 2023] ] },
  { type: "shows", menu: "TV > Anime", title: "Mecha anime", short: "Mecha", picks: [
    ["Mobile Suit Gundam", "Mobile Suit Gundam", 1979], ["Macross", "The Super Dimension Fortress Macross", 1982],
    ["Neon Genesis Evangelion", "Neon Genesis Evangelion", 1995], ["The Vision of Escaflowne", "The Vision of Escaflowne", 1996],
    ["Martian Successor Nadesico", "Martian Successor Nadesico", 1996], ["The Big O", "The Big O", 1999], ["RahXephon", "RahXephon", 2002],
    ["Full Metal Panic!", "Full Metal Panic!", 2002], ["Eureka Seven", "Eureka Seven", 2005], ["Code Geass", "Code Geass: Lelouch of the Rebellion", 2006],
    ["Gurren Lagann", "Gurren Lagann", 2007], ["Knights of Sidonia", "Knights of Sidonia", 2014], ["Aldnoah.Zero", "Aldnoah.Zero", 2014],
    ["Darling in the Franxx", "Darling in the Franxx", 2018], ["86 Eighty-Six", "86 Eighty-Six", 2021] ] },
  // Misc: hand-picked name lists with no pictures.
  { type: "names", cat: "Misc", group: "Food", title: "Popular pizza toppings", picks: [
    "Pepperoni", "Mushrooms", "Extra cheese", "Italian sausage", "Bacon", "Onions", "Green peppers", "Black olives", "Pineapple", "Ham",
    "Chicken", "Jalapeños", "Tomatoes", "Spinach", "Anchovies" ] },
  // International chains only, each with a good number of Canadian locations. At most two burgers per chain.
  { type: "names", cat: "Misc", group: "Food", title: "Pizza chains", picks: [
    "Pizza Hut", "Domino's", "Little Caesars", "Papa John's", "Boston Pizza", "Blaze Pizza", "Pizza Pizza", "Pizza Nova" ] },
  { type: "names", cat: "Misc", group: "Food", title: "Fast-food burgers", picks: [
    ["Big Mac", "McDonald's"], ["Quarter Pounder with Cheese", "McDonald's"], ["Whopper", "Burger King"], ["Bacon King", "Burger King"],
    ["Dave's Single", "Wendy's"], ["Baconator", "Wendy's"], ["Teen Burger", "A&W"], ["Mozza Burger", "A&W"],
    ["Cheeseburger", "Five Guys"], ["FlameThrower GrillBurger", "Dairy Queen"], ["Original Fatburger", "Fatburger"],
    ["Yumburger", "Jollibee"] ] },
  { type: "names", cat: "Misc", group: "Perfumes", title: "Favourite niche perfumes", short: "Niche favourites", picks: [
    ["Warm Bulb", "Clue"], ["Delina", "Parfums de Marly"], ["Santal 33", "Le Labo"], ["Jazz", "Zernell Gillie"],
    ["Girl of the Year", "Thin Wild Mercury"], ["Tears", "Régime des Fleurs"], ["Pas de Chat", "Odette"], ["Delizia di Marshmallow", "Kyse"],
    ["Bee", "Zoologist"], ["Nosferatu", "Heretic"], ["Queening", "Mind Games"], ["Peach's Revenge", "Sarah Baker"],
    ["The Soft Lawn", "Imaginary Authors"], ["White Rice", "d'Annam"], ["Dear Polly", "Vilhelm Parfumerie"] ] },
  // Current Sephora bestsellers for women, at most two per fashion house.
  { type: "names", cat: "Misc", group: "Perfumes", title: "Favourite designer perfumes", short: "Designer favourites", picks: [
    ["Libre", "Yves Saint Laurent"], ["Black Opium", "Yves Saint Laurent"], ["Miss Dior", "Dior"], ["J'adore", "Dior"],
    ["Chance Eau Tendre", "Chanel"], ["Daisy", "Marc Jacobs"], ["Flora Gorgeous Gardenia", "Gucci"], ["Born in Roma Donna", "Valentino"],
    ["La Vie Est Belle", "Lancôme"], ["Flowerbomb", "Viktor & Rolf"], ["Paradoxe", "Prada"], ["Goddess", "Burberry"],
    ["Good Girl", "Carolina Herrera"], ["My Way", "Giorgio Armani"], ["Black Orchid", "Tom Ford"] ] },
  // Every Kayali eau de parfum, 2018 to 2026 (body sprays and hair mists of existing scents are left out).
  { type: "names", cat: "Misc", group: "Perfumes", title: "Kayali perfumes", short: "Kayali", picks: [
    ["Vanilla 28", "2018"], ["Musk 12", "2018"], ["Elixir 11", "2018"], ["Citrus 08", "2018"], ["Déjà Vu White Flower 57", "2020"],
    ["Utopia Vanilla Coco 21", "2021"], ["Sweet Diamond Pink Pepper 25", "2021"], ["Invite Only Amber 23", "2021"], ["Eden Juicy Apple 01", "2021"],
    ["Lovefest Burning Cherry 48", "2022"], ["Vanilla Royale Sugared Patchouli 64", "2022"], ["Yum Pistachio Gelato 33", "2023"],
    ["Eden Sparkling Lychee 39", "2023"], ["The Wedding Silk Santal 36", "2023"], ["The Wedding Velvet Santal 35", "2023"],
    ["Oudgasm Vanilla Oud 36", "2023"], ["Oudgasm Rose Oud 16", "2023"], ["Oudgasm Café Oud 19", "2023"], ["Oudgasm Tobacco Oud 04", "2023"],
    ["Oudgasm Smoky Oud 07", "2024"], ["Vanilla Candy Rock Sugar 42", "2024"], ["Yum Boujee Marshmallow 81", "2024"],
    ["Capri in a Bottle Lemon Sugar 14", "2024"], ["Maldives in a Bottle Ylang Coco 20", "2024"], ["Marrakesh in a Bottle Orange Blossom 24", "2024"],
    ["Maui in a Bottle Sweet Banana 37", "2024"], ["Fleur Majesty Rose Royale 31", "2025"], ["Oudgasm Chocolate Oud 11", "2025"],
    ["Oudgasm Milky Musk Oud 30", "2025"], ["Freedom Musk Santal 34", "2025"], ["Freedom Musk Matcha 45", "2025"], ["Freedom Musk Latte 41", "2025"],
    ["Freedom Musk Bouquet 27", "2025"], ["Eden Plush Pear 23", "2026"], ["Eden Sweet Peach 35", "2026"], ["Boujee Kitty Caramel Milk 22", "2026"] ] },
  { type: "names", cat: "Misc", group: "Perfumes", title: "Favourite celebrity perfumes", short: "Celebrity favourites", picks: [
    ["White Diamonds", "Elizabeth Taylor"], ["Glow", "Jennifer Lopez"], ["Curious", "Britney Spears"], ["Fantasy", "Britney Spears"],
    ["Lovely", "Sarah Jessica Parker"], ["Heat", "Beyoncé"], ["Purr", "Katy Perry"], ["Someday", "Justin Bieber"],
    ["Wonderstruck", "Taylor Swift"], ["Fame", "Lady Gaga"], ["Pink Friday", "Nicki Minaj"], ["Cloud", "Ariana Grande"],
    ["Thank U, Next", "Ariana Grande"], ["Eilish", "Billie Eilish"], ["Fenty Eau de Parfum", "Rihanna"] ] },
  { type: "names", cat: "Misc", group: "Food", title: "Sushi types", picks: [
    ["Nigiri", "fish over pressed rice"], ["Sashimi", "sliced fish, no rice"], ["Maki", "seaweed on the outside"],
    ["Uramaki", "rice on the outside"], ["Temaki", "hand roll"], ["Gunkan", "seaweed-wrapped 'battleship'"],
    ["Chirashi", "fish scattered over rice"], ["Inari", "rice in fried tofu"], ["Oshizushi", "pressed box sushi"],
    ["Tamago", "sweet omelette"], ["Unagi", "grilled eel"], ["California roll", "crab, avocado, cucumber"],
    ["Spicy tuna roll", "tuna with spicy mayo"], ["Dragon roll", "topped with eel and avocado"],
    ["Rainbow roll", "topped with assorted fish"], ["Philadelphia roll", "salmon and cream cheese"] ] },
  { type: "names", cat: "Misc", group: "Drinks", title: "Ontario breweries", picks: [
    ["Steam Whistle", "Toronto"], ["Mill Street", "Toronto"], ["Amsterdam Brewery", "Toronto"], ["Great Lakes Brewery", "Toronto"],
    ["Bellwoods Brewery", "Toronto"], ["Henderson Brewing", "Toronto"], ["Left Field Brewery", "Toronto"], ["Collective Arts", "Hamilton"],
    ["Nickel Brook", "Burlington"], ["Bench Brewing", "Beamsville"], ["Sleeman", "Guelph"], ["Waterloo Brewing", "Kitchener"],
    ["Side Launch", "Collingwood"], ["Flying Monkeys", "Barrie"], ["Muskoka Brewery", "Bracebridge"], ["Sawdust City", "Gravenhurst"],
    ["Beau's", "Vankleek Hill"] ] },
  { type: "names", cat: "Misc", group: "Hobbies", title: "Hobbymaxxing", short: "Hobbymaxxing: crafts and hobbies", picks: [
    "Crocheting", "Knitting", "Embroidery", "Sourdough baking", "Pottery", "Jigsaw puzzles", "Gardening", "Houseplants", "Film photography",
    "Journaling", "Watercolour painting", "LEGO building", "Diamond painting", "Candle making", "Pickleball", "Run clubs", "Book clubs",
    "Board games", "Bouldering", "Thrifting" ] },
  // Year-round three-wick candles (seasonal scents left out).
  { type: "names", cat: "Misc", group: "Perfumes", title: "Bath & Body Works candles", short: "Bath & Body Works candles", picks: [
    "Mahogany Teakwood", "Eucalyptus Spearmint", "Champagne Toast", "Warm Vanilla Sugar", "Japanese Cherry Blossom", "A Thousand Wishes",
    "White Tea & Sage", "Into the Night", "Gingham", "Sweet Pea", "Ocean", "Midnight Blue Citrus" ] },
  // Geography: a mix of big-name cities and popular travel spots.
  { type: "names", cat: "Geography", group: "Capitals", title: "World capitals", picks: [
    ["Tokyo", "Japan"], ["Seoul", "South Korea"], ["Beijing", "China"], ["Bangkok", "Thailand"], ["New Delhi", "India"],
    ["Canberra", "Australia"], ["Paris", "France"], ["London", "United Kingdom"], ["Rome", "Italy"], ["Madrid", "Spain"],
    ["Berlin", "Germany"], ["Athens", "Greece"], ["Ottawa", "Canada"], ["Washington, D.C.", "United States"], ["Mexico City", "Mexico"],
    ["Buenos Aires", "Argentina"], ["Cairo", "Egypt"], ["Nairobi", "Kenya"] ] },
  { type: "names", cat: "Geography", group: "Cities", title: "North American cities", short: "North America", picks: [
    ["New York City", "New York"], ["Los Angeles", "California"], ["San Francisco", "California"], ["Las Vegas", "Nevada"],
    ["Chicago", "Illinois"], ["New Orleans", "Louisiana"], ["Miami", "Florida"], ["Boston", "Massachusetts"], ["Seattle", "Washington"],
    ["Nashville", "Tennessee"], ["Honolulu", "Hawaii"], ["Toronto", "Ontario"], ["Vancouver", "British Columbia"], ["Montreal", "Quebec"],
    ["Quebec City", "Quebec"], ["Mexico City", "Mexico"], ["Cancún", "Mexico"] ] },
  { type: "names", cat: "Geography", group: "Cities", title: "European cities", short: "Europe", picks: [
    ["Paris", "France"], ["London", "England"], ["Rome", "Italy"], ["Venice", "Italy"], ["Florence", "Italy"], ["Barcelona", "Spain"],
    ["Lisbon", "Portugal"], ["Amsterdam", "Netherlands"], ["Berlin", "Germany"], ["Prague", "Czechia"], ["Vienna", "Austria"],
    ["Budapest", "Hungary"], ["Dublin", "Ireland"], ["Edinburgh", "Scotland"], ["Copenhagen", "Denmark"], ["Santorini", "Greece"],
    ["Dubrovnik", "Croatia"], ["Istanbul", "Turkey"] ] },
  { type: "names", cat: "Geography", group: "Cities", title: "Asian cities", short: "Asia", picks: [
    ["Tokyo", "Japan"], ["Kyoto", "Japan"], ["Osaka", "Japan"], ["Seoul", "South Korea"], ["Busan", "South Korea"], ["Beijing", "China"],
    ["Shanghai", "China"], ["Hong Kong", "China"], ["Taipei", "Taiwan"], ["Bangkok", "Thailand"], ["Singapore", "Singapore"],
    ["Kuala Lumpur", "Malaysia"], ["Bali", "Indonesia"], ["Hanoi", "Vietnam"], ["Ho Chi Minh City", "Vietnam"], ["Manila", "Philippines"],
    ["Mumbai", "India"], ["Dubai", "United Arab Emirates"] ] },
  { type: "names", cat: "Geography", group: "Cities", title: "African cities", short: "Africa", picks: [
    ["Cairo", "Egypt"], ["Luxor", "Egypt"], ["Marrakesh", "Morocco"], ["Casablanca", "Morocco"], ["Tunis", "Tunisia"], ["Dakar", "Senegal"],
    ["Accra", "Ghana"], ["Lagos", "Nigeria"], ["Addis Ababa", "Ethiopia"], ["Nairobi", "Kenya"], ["Zanzibar", "Tanzania"],
    ["Kigali", "Rwanda"], ["Victoria Falls", "Zimbabwe"], ["Johannesburg", "South Africa"], ["Durban", "South Africa"],
    ["Cape Town", "South Africa"] ] },
  { type: "names", cat: "Misc", group: "Astrology", title: "Zodiac signs", picks: [
    ["Aries", "\u2648 Mar 21 to Apr 19"], ["Taurus", "\u2649 Apr 20 to May 20"], ["Gemini", "\u264A May 21 to Jun 20"],
    ["Cancer", "\u264B Jun 21 to Jul 22"], ["Leo", "\u264C Jul 23 to Aug 22"], ["Virgo", "\u264D Aug 23 to Sep 22"],
    ["Libra", "\u264E Sep 23 to Oct 22"], ["Scorpio", "\u264F Oct 23 to Nov 21"], ["Sagittarius", "\u2650 Nov 22 to Dec 21"],
    ["Capricorn", "\u2651 Dec 22 to Jan 19"], ["Aquarius", "\u2652 Jan 20 to Feb 18"], ["Pisces", "\u2653 Feb 19 to Mar 20"] ] },
  // Books (from Open Library, no key needed).
  //   "books" is a hand-picked list. A pick is ["Title", "Author"], or ["Name shown", "Author", "title to search for"]
  //           when the tile should show a series name but use its first book's cover. Add a year (a number) to show it on the tile.
  //   "authors" is a hand-picked list of writers, with their Open Library photo where there is one.
  { type: "books", group: "Popular", title: "BookTok favourites", picks: [
    ["It Ends with Us", "Colleen Hoover"], ["Verity", "Colleen Hoover"], ["The Seven Husbands of Evelyn Hugo", "Taylor Jenkins Reid"],
    ["A Court of Thorns and Roses", "Sarah J. Maas"], ["Fourth Wing", "Rebecca Yarros"], ["The Song of Achilles", "Madeline Miller"],
    ["The Love Hypothesis", "Ali Hazelwood"], ["They Both Die at the End", "Adam Silvera"], ["We Were Liars", "E. Lockhart"],
    ["The Invisible Life of Addie LaRue", "V. E. Schwab"], ["Icebreaker", "Hannah Grace"], ["Beach Read", "Emily Henry"],
    ["The Cruel Prince", "Holly Black"], ["Red, White & Royal Blue", "Casey McQuiston"], ["Six of Crows", "Leigh Bardugo"] ] },
  // Genre lists come in two eras so a round is either all classics or all recent books, not a mix.
  { type: "books", group: "Genres", title: "Murder mysteries: classics", picks: [
    ["The Murders in the Rue Morgue", "Edgar Allan Poe"], ["The Moonstone", "Wilkie Collins"], ["The Hound of the Baskervilles", "Arthur Conan Doyle"],
    ["The Murder of Roger Ackroyd", "Agatha Christie"], ["The Maltese Falcon", "Dashiell Hammett"], ["Murder on the Orient Express", "Agatha Christie"],
    ["Gaudy Night", "Dorothy L. Sayers"], ["Death on the Nile", "Agatha Christie"], ["And Then There Were None", "Agatha Christie"],
    ["The Big Sleep", "Raymond Chandler"], ["The Daughter of Time", "Josephine Tey"], ["Cover Her Face", "P. D. James"],
    ["The Name of the Rose", "Umberto Eco"] ] },
  { type: "books", group: "Genres", title: "Murder mysteries: modern", picks: [
    ["The Girl with the Dragon Tattoo", "Stieg Larsson"], ["Still Life", "Louise Penny"], ["In the Woods", "Tana French"],
    ["Gone Girl", "Gillian Flynn"], ["The Cuckoo's Calling", "Robert Galbraith"], ["Big Little Lies", "Liane Moriarty"],
    ["The Woman in Cabin 10", "Ruth Ware"], ["Magpie Murders", "Anthony Horowitz"], ["One of Us Is Lying", "Karen M. McManus"],
    ["A Good Girl's Guide to Murder", "Holly Jackson"], ["The Silent Patient", "Alex Michaelides"], ["The Guest List", "Lucy Foley"],
    ["The Thursday Murder Club", "Richard Osman"], ["The Maid", "Nita Prose"], ["Everyone in My Family Has Killed Someone", "Benjamin Stevenson"] ] },
  { type: "books", group: "Genres", title: "Sci-fi: classics", picks: [
    ["Frankenstein", "Mary Shelley"], ["The War of the Worlds", "H. G. Wells"], ["Brave New World", "Aldous Huxley"],
    ["Foundation", "Isaac Asimov"], ["Fahrenheit 451", "Ray Bradbury"], ["Dune", "Frank Herbert"],
    ["Do Androids Dream of Electric Sheep?", "Philip K. Dick"], ["The Left Hand of Darkness", "Ursula K. Le Guin"],
    ["Slaughterhouse-Five", "Kurt Vonnegut"], ["The Hitchhiker's Guide to the Galaxy", "Douglas Adams"], ["Kindred", "Octavia E. Butler"],
    ["Neuromancer", "William Gibson"], ["Ender's Game", "Orson Scott Card"], ["Hyperion", "Dan Simmons"], ["Snow Crash", "Neal Stephenson"] ] },
  { type: "books", group: "Genres", title: "Sci-fi: modern", picks: [
    ["Old Man's War", "John Scalzi"], ["The Three-Body Problem", "Cixin Liu"], ["The Expanse", "James S. A. Corey", "Leviathan Wakes"],
    ["Ready Player One", "Ernest Cline"], ["The Martian", "Andy Weir"], ["Ancillary Justice", "Ann Leckie"], ["Red Rising", "Pierce Brown"],
    ["Station Eleven", "Emily St. John Mandel"], ["Annihilation", "Jeff VanderMeer"],
    ["The Long Way to a Small, Angry Planet", "Becky Chambers"], ["Children of Time", "Adrian Tchaikovsky"], ["Dark Matter", "Blake Crouch"],
    ["The Murderbot Diaries", "Martha Wells", "All Systems Red"], ["Klara and the Sun", "Kazuo Ishiguro"], ["Project Hail Mary", "Andy Weir"] ] },
  { type: "books", group: "Genres", title: "Fantasy: classics", picks: [
    ["The Hobbit", "J. R. R. Tolkien"], ["The Chronicles of Narnia", "C. S. Lewis", "The Lion, the Witch and the Wardrobe"],
    ["The Lord of the Rings", "J. R. R. Tolkien", "The Fellowship of the Ring"], ["The Once and Future King", "T. H. White"],
    ["Earthsea", "Ursula K. Le Guin", "A Wizard of Earthsea"], ["The Last Unicorn", "Peter S. Beagle"], ["The Princess Bride", "William Goldman"],
    ["The Belgariad", "David Eddings", "Pawn of Prophecy"], ["Discworld", "Terry Pratchett", "The Colour of Magic"],
    ["The Wheel of Time", "Robert Jordan", "The Eye of the World"], ["The Farseer Trilogy", "Robin Hobb", "Assassin's Apprentice"],
    ["His Dark Materials", "Philip Pullman", "Northern Lights"], ["A Song of Ice and Fire", "George R. R. Martin", "A Game of Thrones"],
    ["Harry Potter", "J. K. Rowling", "Harry Potter and the Philosopher's Stone"] ] },
  { type: "books", group: "Genres", title: "Fantasy: modern", picks: [
    ["American Gods", "Neil Gaiman"], ["Jonathan Strange & Mr Norrell", "Susanna Clarke"], ["Mistborn", "Brandon Sanderson", "Mistborn: The Final Empire"],
    ["The Lies of Locke Lamora", "Scott Lynch"], ["The Kingkiller Chronicle", "Patrick Rothfuss", "The Name of the Wind"],
    ["The Stormlight Archive", "Brandon Sanderson", "The Way of Kings"], ["The Night Circus", "Erin Morgenstern"],
    ["Throne of Glass", "Sarah J. Maas"], ["Six of Crows", "Leigh Bardugo"], ["A Court of Thorns and Roses", "Sarah J. Maas"],
    ["The Broken Earth", "N. K. Jemisin", "The Fifth Season"], ["The Poppy War", "R. F. Kuang"],
    ["The Priory of the Orange Tree", "Samantha Shannon"], ["Legends & Lattes", "Travis Baldree"], ["The Empyrean", "Rebecca Yarros", "Fourth Wing"] ] },
  { type: "books", group: "Genres", title: "Poetry: classics", picks: [   // one book per poet
    ["Paradise Lost", "John Milton"], ["Songs of Innocence and of Experience", "William Blake"], ["Leaves of Grass", "Walt Whitman"],
    ["The Complete Poems of Emily Dickinson", "Emily Dickinson"], ["North of Boston", "Robert Frost"], ["The Waste Land", "T. S. Eliot"],
    ["The Tower", "W. B. Yeats"], ["Twenty Love Poems and a Song of Despair", "Pablo Neruda"], ["The Weary Blues", "Langston Hughes"],
    ["Howl and Other Poems", "Allen Ginsberg"], ["Ariel", "Sylvia Plath"], ["And Still I Rise", "Maya Angelou"] ] },
  { type: "books", group: "Genres", title: "Poetry: modern", picks: [     // one book per poet
    ["Sailing Alone Around the Room", "Billy Collins"], ["Love & Misadventure", "Lang Leav"], ["Citizen: An American Lyric", "Claudia Rankine"],
    ["Milk and Honey", "Rupi Kaur"], ["Night Sky with Exit Wounds", "Ocean Vuong"], ["The Princess Saves Herself in This One", "Amanda Lovelace"],
    ["Love Her Wild", "Atticus"], ["Don't Call Us Dead", "Danez Smith"], ["Devotions", "Mary Oliver"], ["The Carrying", "Ada Limón"],
    ["Call Us What We Carry", "Amanda Gorman"], ["Bless the Daughter Raised by a Voice in Her Head", "Warsan Shire"] ] },
  { type: "books", group: "Genres", title: "Graphic novels and series", picks: [
    ["Maus", "Art Spiegelman"], ["Watchmen", "Alan Moore"], ["Batman: The Dark Knight Returns", "Frank Miller"], ["V for Vendetta", "Alan Moore"],
    ["The Sandman", "Neil Gaiman", "The Sandman: Preludes & Nocturnes"], ["Bone", "Jeff Smith", "Bone: Out from Boneville"],
    ["Persepolis", "Marjane Satrapi"], ["Blankets", "Craig Thompson"], ["The Walking Dead", "Robert Kirkman", "The Walking Dead: Days Gone Bye"],
    ["Scott Pilgrim", "Bryan Lee O'Malley", "Scott Pilgrim's Precious Little Life"], ["Fun Home", "Alison Bechdel"],
    ["American Born Chinese", "Gene Luen Yang"], ["Smile", "Raina Telgemeier"], ["Saga", "Brian K. Vaughan", "Saga, Volume 1"],
    ["Nimona", "ND Stevenson"], ["Heartstopper", "Alice Oseman", "Heartstopper: Volume One"] ] },
  // Recent hockey romances in the vein of Heated Rivalry. The number is the publication year shown on the tile.
  { type: "books", group: "Genres > Romance", title: "Hockey romances", short: "Hockey romances", picks: [
    ["Him", "Sarina Bowen", 2015], ["The Deal", "Elle Kennedy", 2015], ["Game Changer", "Rachel Reid", 2018], ["Heated Rivalry", "Rachel Reid", 2019],
    ["Tough Guy", "Rachel Reid", 2020], ["Common Goal", "Rachel Reid", 2020], ["Role Model", "Rachel Reid", 2021], ["Season's Change", "Cait Nary", 2021],
    ["The Long Game", "Rachel Reid", 2022], ["Icebreaker", "Hannah Grace", 2022], ["Mile High", "Liz Tomforde", 2022],
    ["Pucking Around", "Emily Rath", 2023], ["Time to Shine", "Rachel Reid", 2023], ["Delay of Game", "Ari Baran", 2023],
    ["Behind the Net", "Stephanie Archer", 2023], ["Collide", "Bal Khabra", 2024] ] },
  { type: "names", cat: "Books", group: "Genres > Romance", title: "Romance tropes", short: "Romance tropes", picks: [
    "Enemies to lovers", "Friends to lovers", "Fake dating", "Forced proximity", "Only one bed", "Grumpy and sunshine", "Second chance",
    "Slow burn", "Forbidden love", "Love triangle", "Marriage of convenience", "Brother's best friend", "Workplace romance",
    "Secret royal", "He falls first" ] },
  { type: "books", group: "Young adult", title: "YA standalone favourites", short: "Standalone favourites", picks: [
    ["The Perks of Being a Wallflower", "Stephen Chbosky"],
    ["Looking for Alaska", "John Green"], ["The Book Thief", "Markus Zusak"], ["Thirteen Reasons Why", "Jay Asher"],
    ["The Fault in Our Stars", "John Green"], ["Eleanor & Park", "Rainbow Rowell"], ["Fangirl", "Rainbow Rowell"],
    ["We Were Liars", "E. Lockhart"], ["I'll Give You the Sun", "Jandy Nelson"], ["Everything, Everything", "Nicola Yoon"],
    ["The Sun Is Also a Star", "Nicola Yoon"], ["Radio Silence", "Alice Oseman"],
    ["The Hate U Give", "Angie Thomas"], ["They Both Die at the End", "Adam Silvera"], ["Turtles All the Way Down", "John Green"] ] },
  { type: "books", group: "Young adult", title: "YA series favourites", short: "Series favourites", picks: [
    ["His Dark Materials", "Philip Pullman", "Northern Lights"], ["Harry Potter", "J. K. Rowling", "Harry Potter and the Philosopher's Stone"],
    ["Uglies", "Scott Westerfeld"], ["Percy Jackson", "Rick Riordan", "The Lightning Thief"], ["Twilight", "Stephenie Meyer"],
    ["The Mortal Instruments", "Cassandra Clare", "City of Bones"], ["The Hunger Games", "Suzanne Collins"], ["The Maze Runner", "James Dashner"],
    ["Divergent", "Veronica Roth"], ["The Lunar Chronicles", "Marissa Meyer", "Cinder"], ["The Selection", "Kiera Cass"],
    ["Throne of Glass", "Sarah J. Maas"], ["Shadow and Bone", "Leigh Bardugo"], ["Red Queen", "Victoria Aveyard"],
    ["An Ember in the Ashes", "Sabaa Tahir"] ] },
  { type: "authors", title: "Most popular authors", picks: [
    "Stephen King", "J. K. Rowling", "Agatha Christie", "James Patterson", "Colleen Hoover", "Dan Brown", "John Grisham", "Nora Roberts",
    "Danielle Steel", "George R. R. Martin", "Brandon Sanderson", "Sarah J. Maas", "Neil Gaiman", "Haruki Murakami", "Roald Dahl" ] },
  { type: "authors", title: "Top women authors", picks: [
    "Jane Austen", "Mary Shelley", "Charlotte Brontë", "Virginia Woolf", "Agatha Christie", "Toni Morrison", "Maya Angelou",
    "Ursula K. Le Guin", "Margaret Atwood", "Octavia E. Butler", "Donna Tartt", "J. K. Rowling", "Zadie Smith",
    "Chimamanda Ngozi Adichie", "Sally Rooney" ] },
  { type: "authors", title: "Top POC authors", picks: [
    "James Baldwin", "Gabriel García Márquez", "Chinua Achebe", "Toni Morrison", "Maya Angelou", "Octavia E. Butler", "Haruki Murakami",
    "Salman Rushdie", "Amy Tan", "Kazuo Ishiguro", "Jhumpa Lahiri", "Zadie Smith", "Colson Whitehead", "Chimamanda Ngozi Adichie",
    "N. K. Jemisin" ] },
  { type: "authors", title: "Top Canadian authors", picks: [
    "L. M. Montgomery", "Robertson Davies", "Margaret Laurence", "Mordecai Richler", "Alice Munro", "Leonard Cohen", "Margaret Atwood",
    "Michael Ondaatje", "Thomas King", "Douglas Coupland", "Yann Martel", "Miriam Toews", "Louise Penny", "Esi Edugyan",
    "Emily St. John Mandel" ] },
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
  { type: "games", menu: "Games > Franchises > Pokémon", title: "Pokémon generations", short: "Generations", picks: [
    ["Gen 1: Red, Blue & Yellow", "Pokémon Red", 1996], ["Gen 2: Gold, Silver & Crystal", "Pokémon Gold", 1999],
    ["Gen 3: Ruby, Sapphire & Emerald", "Pokémon Ruby", 2002], ["Gen 4: Diamond, Pearl & Platinum", "Pokémon Diamond", 2006],
    ["Gen 5: Black & White", "Pokémon Black", 2010], ["Gen 6: X & Y", "Pokémon X", 2013], ["Gen 7: Sun & Moon", "Pokémon Sun", 2016],
    ["Gen 8: Sword & Shield", "Pokémon Sword", 2019], ["Gen 9: Scarlet & Violet", "Pokémon Scarlet", 2022] ] },
  { type: "names", menu: "Games > Franchises > Pokémon", title: "Pokémon fire starters", short: "Fire starters", picks: [
    ["Charmander", "Gen 1"], ["Cyndaquil", "Gen 2"], ["Torchic", "Gen 3"], ["Chimchar", "Gen 4"], ["Tepig", "Gen 5"], ["Fennekin", "Gen 6"],
    ["Litten", "Gen 7"], ["Scorbunny", "Gen 8"], ["Fuecoco", "Gen 9"] ] },
  { type: "names", menu: "Games > Franchises > Pokémon", title: "Pokémon water starters", short: "Water starters", picks: [
    ["Squirtle", "Gen 1"], ["Totodile", "Gen 2"], ["Mudkip", "Gen 3"], ["Piplup", "Gen 4"], ["Oshawott", "Gen 5"], ["Froakie", "Gen 6"],
    ["Popplio", "Gen 7"], ["Sobble", "Gen 8"], ["Quaxly", "Gen 9"] ] },
  { type: "names", menu: "Games > Franchises > Pokémon", title: "Pokémon grass starters", short: "Grass starters", picks: [
    ["Bulbasaur", "Gen 1"], ["Chikorita", "Gen 2"], ["Treecko", "Gen 3"], ["Turtwig", "Gen 4"], ["Snivy", "Gen 5"], ["Chespin", "Gen 6"],
    ["Rowlet", "Gen 7"], ["Grookey", "Gen 8"], ["Sprigatito", "Gen 9"] ] },
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
  { type: "console", name: "Nintendo 64", title: "Best Nintendo 64 games", since: 1996, oneSeries: true },
  { type: "console", name: "SNES", title: "Best Super Nintendo games", since: 1990, oneSeries: true },
  { type: "console", name: "Nintendo Switch", title: "Best Nintendo Switch games", order: "-metacritic", since: 2017, oneSeries: true },
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
  //   perSeason: 8 guarantees the eight top-billed characters of every season a place, so one-season leads are not lost.
  //   exclude drops characters by name (Lady Whistledown is Penelope).
  // Whedonverse: Buffy and Angel share one submenu, with a best-of list across Joss Whedon's shows (Marvel titles left out).
  { type: "tv",         name: "Buffy the Vampire Slayer", year: 1997, group: "Whedonverse", short: "Buffy seasons" },
  { type: "cast",       name: "Buffy the Vampire Slayer", year: 1997, perSeason: 6, count: 14, group: "Whedonverse", short: "Buffy characters" },
  { type: "tv",         name: "Angel", year: 1999, group: "Whedonverse", short: "Angel seasons" },
  { type: "cast",       name: "Angel", year: 1999, perSeason: 6, count: 12, group: "Whedonverse", short: "Angel characters" },
  { type: "people", cat: "TV", group: "Whedonverse", title: "Whedonverse best characters", short: "Best characters across the Whedonverse", picks: [
    ["Buffy Summers", "Buffy the Vampire Slayer", "Sarah Michelle Gellar"], ["Willow Rosenberg", "Buffy the Vampire Slayer", "Alyson Hannigan"],
    ["Spike", "Buffy the Vampire Slayer", "James Marsters"], ["Angel", "Angel", "David Boreanaz"], ["Cordelia Chase", "Angel", "Charisma Carpenter"],
    ["Wesley Wyndam-Pryce", "Angel", "Alexis Denisof"], ["Malcolm Reynolds", "Firefly", "Nathan Fillion"], ["River Tam", "Firefly", "Summer Glau"],
    ["Kaylee Frye", "Firefly", "Jewel Staite"], ["Echo", "Dollhouse", "Eliza Dushku"], ["Topher Brink", "Dollhouse", "Fran Kranz"],
    ["Dr. Horrible", "Dr. Horrible's Sing-Along Blog", "Neil Patrick Harris"], ["Penny", "Dr. Horrible's Sing-Along Blog", "Felicia Day"] ] },
  { type: "cast",       name: "Bridgerton", perSeason: 8, count: 18, exclude: ["Whistledown"] },
  // Hand-picked, because each Simpsons voice actor plays many characters and TMDB credits them as one combined role.
  { type: "names", cat: "TV", group: "The Simpsons", title: "The Simpsons main characters", short: "Main characters", picks: [
    "Homer Simpson", "Marge Simpson", "Bart Simpson", "Lisa Simpson", "Maggie Simpson", "Grampa Simpson", "Ned Flanders", "Mr. Burns",
    "Waylon Smithers", "Moe Szyslak", "Krusty the Clown", "Milhouse Van Houten", "Apu Nahasapeemapetilon", "Chief Wiggum",
    "Principal Skinner", "Sideshow Bob", "Barney Gumble", "Nelson Muntz", "Ralph Wiggum", "Comic Book Guy" ] },
  //   photos: false leaves the actor photos off, for animated shows where the picture would be the voice actor.
  //   group / short put a list in a shared submenu under a different label, here one "Avatar universe" menu for both shows.
  { type: "cast",       name: "Avatar: The Last Airbender", year: 2005, photos: false, group: "Avatar universe", short: "The Last Airbender characters" },
  { type: "cast",       name: "The Legend of Korra", photos: false, group: "Avatar universe", short: "The Legend of Korra characters" },
  { type: "names", cat: "TV", group: "Avatar universe", title: "Avatar universe bending abilities", short: "Bending abilities", picks: [
    "Waterbending", "Earthbending", "Firebending", "Airbending", "Metalbending", "Lightning generation", "Bloodbending", "Healing",
    "Lavabending", "Sandbending", "Plantbending", "Combustionbending", "Energybending", "Spirit projection", "Flight" ] },
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
// noSequels: true keeps a franchise film only if it is the first one released in its franchise.
const firstFilmCache = new Map();
async function firstFilmOf(collectionId) {
  if (!firstFilmCache.has(collectionId)) {
    const c = await tmdb(`/collection/${collectionId}`);
    const dated = (c.parts || []).filter(p => p.release_date).sort((a, b) => a.release_date.localeCompare(b.release_date));
    firstFilmCache.set(collectionId, dated.length ? dated[0].id : null);
  }
  return firstFilmCache.get(collectionId);
}
async function pickMovies(candidates, { minVotes = MIN_VOTES, noDisney = false, oneFranchise = false, noSequels = false, max = MAX_ITEMS } = {}) {
  const franchises = new Set();
  const seen = new Set();
  const pool = candidates
    .filter(m => m.release_date && m.release_date <= today && !m.video && m.vote_count >= minVotes)
    .filter(m => !(m.genre_ids || []).includes(99))            // no documentaries
    .filter(m => !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => b.vote_count - a.vote_count);
  const out = [];
  for (const m of pool) {
    if (out.length >= max) break;
    if (EXCLUDE_MARVEL || noDisney || oneFranchise || noSequels) {
      const f = await studioFlags(m.id);
      if ((EXCLUDE_MARVEL && f.marvel) || (noDisney && f.disney)) continue;
      if (noSequels && f.franchise && (await firstFilmOf(f.franchise)) !== m.id) continue;
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

// ---- Open Library (books) ----
// No key needed. Open Library asks apps to identify themselves and not to hammer it, so there is a short pause per request.
async function openLibrary(path, params = {}) {
  await sleep(350);
  const url = new URL("https://openlibrary.org" + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { "User-Agent": MB_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open Library ${res.status} on ${path}`);
  return res.json();
}
// Finds a book by title and author. Only accepts a result credited to that author, and prefers an exact title match,
// so a different book that happens to share the title is never used. Returns null when nothing fits.
async function findBook(title, author) {
  const r = await openLibrary("/search.json", { title, author, limit: 20, fields: "key,title,author_name,cover_i,edition_count" });
  const surname = plain(author).split(" ").pop();
  const byAuthor = (r.docs || []).filter(d => (d.author_name || []).some(n => plain(n).split(" ").includes(surname)));
  const exact = byAuthor.filter(d => plain(d.title) === plain(title));
  const pool = (exact.length ? exact : byAuthor).sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0));
  return pool.find(d => d.cover_i) || pool[0] || null;
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

// "Aang (voice)" -> "Aang"
const cleanRole = s => s.replace(/\s*\((voice|uncredited)\)/gi, "").trim();
const CATS = { books: "Books", games: "Games", music: "Music", people: "Actors & directors", franchise: "Franchises", genre: "Genres", year: "Movies by year", tv: "TV" };

const builders = {
  async actor(def) {
    const p = await findPerson(def.name);
    const c = await tmdb(`/person/${p.id}/movie_credits`);
    const leads = c.cast.filter(m => m.order !== undefined && m.order < (def.billing || 8) && !/uncredited|voice|self/i.test(m.character || ""));
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
    return { cat: CATS.franchise, title: def.title || first.name.replace(/ Collection$/, "") + " films", items: await pickMovies(parts, { minVotes: 0, max: def.max || MAX_ITEMS }) };
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
    const ids = [def.name].concat(def.and || []).map(n => {
      const g = all.find(x => x.name.toLowerCase() === n.toLowerCase());
      if (!g) throw new Error(`No genre called "${n}". Options: ${all.map(x => x.name).join(", ")}`);
      return g.id;
    });
    const filtered = def.noDisney || def.oneFranchise || def.noSequels;
    const pages = await Promise.all((filtered ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map(page => tmdb("/discover/movie", { with_genres: ids.join(","), sort_by: "vote_count.desc", page })));
    const opts = { noDisney: !!def.noDisney, oneFranchise: !!def.oneFranchise, noSequels: !!def.noSequels };
    return { cat: CATS.genre, title: def.title || `Biggest ${def.name.toLowerCase()} movies`, items: await pickMovies(pages.flatMap(p => p.results), opts) };
  },
  // A hand-picked list of books; covers and years are looked up on Open Library.
  async books(def) {
    const items = [];
    for (const pick of def.picks) {
      const [name, author] = pick, searchTitle = typeof pick[2] === "string" ? pick[2] : null, yr = pick.find(x => typeof x === "number");
      let d = null;
      try { d = await findBook(searchTitle || name, author); } catch (e) { console.warn(`  Open Library lookup failed for "${name}": ${e.message}`); }
      if (!d || !d.cover_i) console.warn(`  no Open Library cover for "${searchTitle || name}" by ${author}; added without one`);
      // The tile shows the author, plus the year only when the pick states it: Open Library's own dates are often an old edition's.
      items.push({ id: "b" + slug(name + " " + author), name, note: author + (yr ? ", " + yr : ""),
        ...(d && d.cover_i ? { img: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` } : {}) });
    }
    return { cat: CATS.books, group: def.group || "Genres", short: def.short || def.title, title: def.title, items };
  },
  // A hand-picked list of writers, with a photo where Open Library has one.
  async authors(def) {
    const items = [];
    for (const name of def.picks) {
      let img = null;
      try {
        const r = await openLibrary("/search/authors.json", { q: name, limit: 5 });
        const a = (r.docs || []).sort((x, y) => (y.work_count || 0) - (x.work_count || 0))[0];
        if (a) {
          const url = `https://covers.openlibrary.org/a/olid/${a.key.replace(/^.*\//, "")}-M.jpg`;
          const head = await fetch(url + "?default=false", { method: "HEAD", redirect: "manual" });
          if (head.status < 400) img = url;
        }
      } catch (e) {}
      items.push({ id: "w" + slug(name), name, ...(img ? { img } : {}) });
    }
    return { cat: CATS.books, group: def.group || "Authors", short: def.short || def.title, title: def.title, items };
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
  //   since: the console's launch year. With it, only games that debuted on this console are kept: nothing first released
  //          before the console existed, and nothing that also came out on another company's machines (ports).
  //          Later re-releases on the same maker's newer consoles are fine.
  //   oneSeries: true keeps only the top game from each series, so sequels on the same console drop out.
  async console(def) {
    const p = await findPlatform(def.name);
    const family = new RegExp(def.family || "nintendo|wii|gamecube|game boy|nes", "i");
    const candidates = [];
    for (const page of [1, 2, 3, 4]) {
      const r = await rawg("/games", { platforms: p.id, ordering: def.order || "-added", page_size: 40, page });
      candidates.push(...(r.results || []));
      if (!r.next) break;
    }
    const original = g => !def.since || (Number(year(g.released)) >= def.since &&
      (g.platforms || []).every(x => x.platform.id === p.id || family.test(x.platform.name)));
    const seenNames = new Set(), taken = new Set(), picked = [];
    for (const g of candidates) {
      if (picked.length >= MAX_ITEMS) break;
      if (!g.released || g.released > today || seenNames.has(plain(g.name)) || taken.has(g.id) || !original(g)) continue;
      seenNames.add(plain(g.name));
      if (def.oneSeries) {
        // Everything else in this game's series is now off the table.
        for (const page of [1, 2, 3]) {
          let s; try { s = await rawg(`/games/${g.id}/game-series`, { page_size: 40, page }); } catch (e) { break; }
          (s.results || []).forEach(x => taken.add(x.id));
          if (!s.next) break;
        }
      }
      picked.push(g);
    }
    const items = picked.sort((a, b) => a.released.localeCompare(b.released)).map(g => gameItem(g));
    return { cat: CATS.games, group: "Consoles", short: def.title || p.name, title: def.title || `Best ${p.name} games`, items };
  },
  // A hand-picked movie list. Titles are matched on TMDB by name and release year; the Marvel filter is not applied.
  async films(def) {
    const items = [];
    // A pick is ["Title", year], or ["Title", year, TMDB id] to point at one exact film when the search finds the wrong one.
    // The tile always shows the title written here, not TMDB's, so alternate release titles never appear.
    for (const [title, yr, id] of def.picks) {
      let m = null;
      if (id) { try { m = await tmdb(`/movie/${id}`); } catch (e) {} }
      if (!m) {
        // Search by title, then prefer the best-known result released within a year of the given year.
        const r = await tmdb("/search/movie", { query: title });
        const close = r.results.filter(x => !yr || Math.abs(Number(year(x.release_date)) - yr) <= 1);
        const exact = close.filter(x => x.title.toLowerCase() === title.toLowerCase());
        m = (exact.length ? exact : close).sort((x, y) => y.vote_count - x.vote_count)[0];
      }
      if (!m) { console.warn(`  no TMDB match for "${title}" (${yr || "any year"}); left out`); continue; }
      items.push({ ...movieItem(m), name: title });
    }
    return { cat: def.cat || CATS.franchise, ...(def.group ? { group: def.group, short: def.short || def.title } : {}), title: def.title, items };
  },
  async tv(def) {
    const show = await tmdb(`/tv/${(await findShow(def.name, def.year)).id}`);
    const items = show.seasons
      .filter(s => s.season_number > 0 && s.air_date && s.air_date <= today)
      .slice(0, 16)
      .map(s => ({ id: "s" + s.id, name: s.name, note: year(s.air_date), poster: s.poster_path || show.poster_path || null }));
    return { cat: CATS.tv, ...(def.group ? { group: def.group, short: def.short || "Seasons" } : {}), title: `${show.name} seasons`, items };
  },
  // A show's main characters, ranked list of the ones who appear in the most episodes. Tiles show the actor's photo.
  async cast(def) {
    const show = await tmdb(`/tv/${(await findShow(def.name, def.year)).id}`);
    const credits = await tmdb(`/tv/${show.id}/aggregate_credits`);
    // The top-billed people of each season always get a place (perSeason), so a lead who was only in one season is kept.
    const must = new Set();
    if (def.perSeason) {
      for (const s of (show.seasons || []).filter(s => s.season_number > 0 && s.air_date && s.air_date <= today)) {
        try {
          const c = await tmdb(`/tv/${show.id}/season/${s.season_number}/credits`);
          (c.cast || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, def.perSeason).forEach(p => must.add(p.id));
        } catch (e) {}
      }
    }
    const banned = (def.exclude || []).map(x => x.toLowerCase());
    const seen = new Set();
    const everyone = (credits.cast || [])
      .sort((a, b) => b.total_episode_count - a.total_episode_count)
      // An actor can have several credits on one show; use the character they played in the most episodes.
      .map(p => ({ p, character: cleanRole(((p.roles || []).slice().sort((a, b) => (b.episode_count || 0) - (a.episode_count || 0))[0] || {}).character || "") }))
      .filter(x => x.character && !/^(self|additional voices?|various)\b/i.test(x.character))
      .filter(x => !banned.some(w => x.character.toLowerCase().includes(w)))
      .filter(x => !seen.has(x.character.toLowerCase()) && seen.add(x.character.toLowerCase()));
    const count = def.count || MAX_CAST;
    const leads = everyone.filter(x => must.has(x.p.id)).slice(0, count);
    const rest = everyone.filter(x => !must.has(x.p.id)).slice(0, Math.max(0, count - leads.length));
    const items = [...leads, ...rest].sort((a, b) => b.p.total_episode_count - a.p.total_episode_count)
      .map(x => ({ id: "p" + x.p.id, name: x.character, note: x.p.name, poster: def.photos === false ? null : x.p.profile_path || null }));
    return { cat: CATS.tv, group: def.group || show.name, short: def.short || "Main characters", title: `${show.name} main characters`, items };
  },
  // A hand-picked list of TV shows, with posters from TMDB.
  async shows(def) {
    const items = [];
    for (const pick of def.picks) {
      const [name, query, yr] = [].concat(pick);
      let res = [];
      try {
        res = (await tmdb("/search/tv", yr ? { query: query || name, first_air_date_year: yr } : { query: query || name })).results || [];
        if (!res.length && yr) res = (await tmdb("/search/tv", { query: query || name })).results || [];
      } catch (e) {}
      const s = res.sort((a, b) => b.vote_count - a.vote_count)[0];
      if (!s) console.warn(`  no TMDB show found for "${query || name}"; added without a poster`);
      items.push({ id: "t" + (s ? s.id : slug(name)), name, note: yr ? String(yr) : s ? year(s.first_air_date) : "", poster: (s && s.poster_path) || null });
    }
    return { cat: CATS.tv, title: def.title, items };
  },
  // A hand-picked list of real people, with their TMDB photos.
  async people(def) {
    const items = [];
    for (const pick of def.picks) {
      // A pick is "Name", ["Name", "note"], or ["Character", "note", "Actor"] to show a character with the actor's photo.
      const [name, note, person] = [].concat(pick);
      let p = null;
      try { const r = await tmdb("/search/person", { query: person || name }); p = r.results.find(x => x.name.toLowerCase() === (person || name).toLowerCase()) || r.results[0] || null; } catch (e) {}
      if (!p) console.warn(`  no TMDB person found for "${name}"; added without a photo`);
      items.push({ id: "h" + slug(name), name, ...(note ? { note } : {}), poster: (p && p.profile_path) || null });
    }
    return { cat: def.cat || "Movies", group: def.group || "Characters", short: def.short || def.title, title: def.title, items };
  },
  // The main characters of one film (in billing order), or of a whole franchise when "collection" is given.
  // Across a franchise, a character scores for every film they are in, and more the higher they are billed.
  async filmcast(def) {
    let films, fallbackTitle;
    if (def.collection) {
      const r = await tmdb("/search/collection", { query: def.collection });
      if (!r.results.length) throw new Error("No collection found for " + def.collection);
      const c = await tmdb(`/collection/${r.results[0].id}`);
      films = (c.parts || []).filter(p => p.release_date && p.release_date <= today);
      fallbackTitle = c.name.replace(/ Collection$/, "") + " main characters";
    } else {
      const r = await tmdb("/search/movie", def.year ? { query: def.name, primary_release_year: def.year } : { query: def.name });
      const m = (r.results || []).sort((a, b) => b.vote_count - a.vote_count)[0];
      if (!m) throw new Error("No film found for " + def.name);
      films = [m]; fallbackTitle = `${m.title} main characters`;
    }
    const people = new Map();
    for (const f of films) {
      const c = await tmdb(`/movie/${f.id}/credits`);
      (c.cast || []).slice(0, 30).forEach(p => {
        const character = cleanRole(p.character || "");
        if (!character) return;
        const x = people.get(p.id) || { p, score: 0, names: {} };
        x.score += Math.max(1, 30 - (p.order || 0));                 // top billing in a film is worth the most
        x.names[character] = (x.names[character] || 0) + 1;
        if (!x.p.profile_path && p.profile_path) x.p = p;
        people.set(p.id, x);
      });
    }
    const items = [...people.values()].sort((a, b) => b.score - a.score).slice(0, def.count || MAX_CAST)
      .map(x => ({ id: "p" + x.p.id, name: Object.entries(x.names).sort((a, b) => b[1] - a[1])[0][0], note: x.p.name, poster: def.photos === false ? null : x.p.profile_path || null }));
    const title = def.title || fallbackTitle;
    return { cat: "Movies", group: def.group || "Characters", short: title, title, items };
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
      out.push({ cat: CATS.tv, group: `${def.group || show.name} > Episodes by season`, short: `Season ${n}`, title: `${show.name} season ${n} episodes`, items });
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
      try { const t = await trackList(g, artist.name); out.push({ ...t, group: `${artist.name} > Songs by album`, short: g.title }); }
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
    const items = def.picks.map(p => { const [n, note] = [].concat(p); return { id: "n" + slug(n), name: n, ...(note ? { note } : {}), ...((def.cat || CATS.music) === CATS.music ? { sq: true } : {}) }; });
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
    const ids = [];
    for (const name of [def.name].concat(def.and || [])) {
      const r = await tmdb("/search/keyword", { query: name });
      const k = r.results.find(x => x.name.toLowerCase() === name.toLowerCase()) || r.results[0];
      if (!k) throw new Error(`No keyword called "${name}"`);
      ids.push(k.id);
    }
    const filtered = def.noDisney || def.oneFranchise || def.noSequels;
    const pages = await Promise.all((filtered ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map(page => tmdb("/discover/movie", { with_keywords: ids.join(","), sort_by: "vote_count.desc", page })));
    const opts = { noDisney: !!def.noDisney, oneFranchise: !!def.oneFranchise, noSequels: !!def.noSequels };
    return { cat: CATS.genre, title: def.title || `Biggest ${def.name} movies`, items: await pickMovies(pages.flatMap(p => p.results), opts) };
  },
  // A list of TV shows (not seasons) from one TMDB TV genre.
  async tvgenre(def) {
    const all = (await tmdb("/genre/tv/list")).genres;
    const g = all.find(x => x.name.toLowerCase() === def.name.toLowerCase());
    if (!g) throw new Error(`No TV genre called "${def.name}". Options: ${all.map(x => x.name).join(", ")}`);
    const pages = await Promise.all((def.perFranchise ? [1, 2, 3, 4] : [1, 2]).map(page => tmdb("/discover/tv", { with_genres: g.id, sort_by: "vote_count.desc", page, ...(def.lang ? { with_original_language: def.lang } : {}) })));
    // perFranchise caps how many shows from one franchise get in. Shows count as one franchise when one name starts
    // with the other (Naruto, Naruto Shippuden) or their first two words match (Dragon Ball Z, Dragon Ball Super).
    const fkey = s => plain(s.name).replace(/^the /, "");
    const sameFranchise = (a, b) => {
      const x = fkey(a), y = fkey(b), two = k => k.split(" ").slice(0, 2).join(" ");
      return x === y || x.startsWith(y + " ") || y.startsWith(x + " ") || (x.includes(" ") && y.includes(" ") && two(x) === two(y));
    };
    const out = [];
    for (const s of pages.flatMap(p => p.results)) {
      if (out.length >= MAX_ITEMS) break;
      if (!s.first_air_date || s.first_air_date > today || out.some(x => x.id === s.id)) continue;
      if (def.perFranchise && out.filter(x => sameFranchise(x, s)).length >= def.perFranchise) continue;
      if (EXCLUDE_MARVEL && await isMarvelShow(s.id)) continue;
      out.push(s);
    }
    const items = out.sort((a, b) => a.first_air_date.localeCompare(b.first_air_date))
      .map(s => ({ id: "t" + s.id, name: s.name, note: year(s.first_air_date), poster: s.poster_path || null }));
    return { cat: CATS.tv, title: def.title || `Biggest ${g.name} shows`, items };
  }
};

// Your own pictures. Put an image file in the repo at images/<list name>/<item name>.jpg (or .png / .webp), with both names
// written in lower case with dashes, e.g. images/favourite-niche-perfumes/warm-bulb.jpg. It replaces any picture the item had.
// The build log lists the exact file name for every item that still has no picture.
const IMAGE_TYPES = ["jpg", "jpeg", "png", "webp"];
function addLocalImages(list) {
  const missing = [];
  for (const it of list.items) {
    const base = `images/${slug(list.title)}/${slug(it.name)}`;
    const found = IMAGE_TYPES.map(t => `${base}.${t}`).find(f => fs.existsSync(f));
    if (found) { it.img = found; delete it.img2; delete it.poster; }
    else if (!it.img && !it.poster) missing.push(`${base}.jpg`);
  }
  return missing;
}

// Where each list sits in the game's menu. The menu is: category, then submenu, then list.
//   Movies         > Franchises (James Bond has its own submenu), Genres, Actors, Directors, By year > 1980s..., Awards, Characters
//   TV             > one submenu per show or universe (Episodes by season inside), Anime, plus Show rankings
//   Music          > one submenu per artist (with Songs by album inside where there are many), plus Top albums and Top artists
//   Books          > Popular, Genres (Romance has its own submenu), Young adult, Authors
//   Games          > Franchises (Pokémon has its own submenu), Genres, Consoles, Awards
//   Misc           > Food, Perfumes
function place(list, def) {
  if (def.menu) {
    const [cat, ...rest] = def.menu.split(" > ");
    return { ...list, cat, group: rest.length ? rest.join(" > ") : undefined, short: list.short || def.short || list.title };
  }
  if (list.cat === CATS.franchise) return { ...list, cat: "Movies", group: "Franchises", short: list.title };
  if (list.cat === CATS.people) return { ...list, cat: "Movies", group: def.type === "director" ? "Directors" : "Actors", short: list.title };
  if (list.cat === CATS.genre) return { ...list, cat: "Movies", group: "Genres", short: list.title };
  if (list.cat === "Awards") return { ...list, cat: "Movies", group: "Awards", short: list.title };
  if (list.cat === CATS.year) return { ...list, cat: "Movies", group: "By year > " + list.group };     // e.g. "By year > 1990s"
  return list;
}
// Submenus appear in the order their first list appears in the file, so the finished lists are sorted into this order.
const MENU_ORDER = {
  Movies: ["Franchises", "Genres", "Actors", "Directors", "By year", "Awards", "Characters"],
  Books: ["Popular", "Genres", "Young adult", "Authors"],
  Games: ["Franchises", "Genres", "Consoles", "Awards"],
  Misc: ["Food", "Drinks", "Perfumes", "Hobbies", "Astrology"],
  Geography: ["Capitals", "Cities"]
};
const KIND_ORDER = { tv: 0, albums: 0, episodes: 1, singles: 1, cast: 2, filmcast: 2, names: 3, people: 3, tracks: 4 };
function kindRank(list) {
  if (/ > (Songs by album|Episodes by season)$/.test(list.group || "")) return list.group.endsWith("Episodes by season") ? 1 : 4;
  return list.t in KIND_ORDER ? KIND_ORDER[list.t] : 3;
}
function menuRank(list) {
  const order = MENU_ORDER[list.cat];
  if (!order) return 0;
  const i = order.findIndex(g => (list.group || "") === g || (list.group || "").startsWith(g + " > "));
  return i < 0 ? order.length : i;
}

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
        const missing = addLocalImages(list);
        if (missing.length) console.log(`  ${missing.length} without a picture. To add your own, upload:\n    ${missing.join("\n    ")}`);
        built.push({ id: slug(list.title), src, t: def.type, ...place(list, def) });
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
  // Submenus keep the order they first appear in. Inside each one, lists are grouped by kind: a show's seasons, then its
  // episodes, then its characters, then general lists; an artist's albums, then singles, then other lists, then songs by album.
  const firstSeen = new Map();
  lists.forEach((l, i) => {
    l._i = i;
    const key = l.cat + "|" + (l.group || "").split(" > ")[0];
    if (!firstSeen.has(key)) firstSeen.set(key, i);
    l._g = firstSeen.get(key);
  });
  lists.sort((a, b) => menuRank(a) - menuRank(b) || a._g - b._g || kindRank(a) - kindRank(b) || a._i - b._i);
  lists.forEach(l => { delete l._i; delete l._g; });
  fs.writeFileSync("lists.json", JSON.stringify({ generated: today, lists }, null, 1));
  console.log(`Wrote lists.json with ${lists.length} lists.`);
})();

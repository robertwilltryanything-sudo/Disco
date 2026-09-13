import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";

export interface ArtistSortResult {
  artist: string;
  sort_name: string;
  isGroup: boolean;
  groupChar: string;
  reason: string;
}

// Common single-word artists / mononyms
const MONONYMS = new Set([
  'prince', 'madonna', 'cher', 'sting', 'björk', 'bjork', 'beck', 'seal',
  'adele', 'beyoncé', 'beyonce', 'rihanna', 'sade', 'enya', 'moby', 'dido',
  'kylie', 'lorde', 'drake', 'nas', 'usher', 'slash', 'flea', 'bono',
  'eminem', 'shakira', 'kesha', 'brandy', 'monica', 'ciara', 'aaliyah',
  'sia', 'pink', 'p!nk', 'jewel', 'rufus', 'dr. dre', 'dr dre', 'snoop dogg',
  'ice cube', 'ice-t', '50 cent', '2pac', 'tupac', 'future', 'pitbull',
  'meat loaf', 'alice cooper', 'marilyn manson'
]);

// Words in artist names that strongly signify a band or ensemble
const BAND_KEYWORDS = [
  'band', 'orchestra', 'ensemble', 'quartet', 'trio', 'quintet', 'sextet', 'septet', 'octet',
  'brothers', 'sisters', 'boys', 'girls', 'club', 'society', 'syndicate', 'sound', 'system',
  'project', 'collective', 'choir', 'gang', 'machine', 'division', 'temple', 'experience',
  'factory', 'connection', 'express', 'movement', 'revolution', 'all-stars', 'all stars',
  'family', 'sons', 'kids', 'youth', 'friends', 'league', 'chorus', 'philharmonic', 'symphony',
  'players', 'foundation', 'workshop', 'circus', 'theatre', 'theater', 'corporation', 'company',
  'crew', 'generation', 'tribe', 'union', 'association', 'duo'
];

// Comprehensive catalog of well-known multi-word bands that might otherwise look like a person's name
const KNOWN_BANDS = new Set([
  // D
  'dire straits', 'def leppard', 'depeche mode', 'dinosaur jr', 'dinosaur jr.', 'dinosaur junior',
  'deep purple', 'duran duran', 'dead kennedys', 'dropkick murphys', 'drive like jehu',
  'death cab for cutie', 'deerhunter', 'dirty projectors', 'daft punk', 'dexys midnight runners',
  'devo', 'dead can dance', 'descendents', 'disturbed', 'dream theater', 'dismemberment plan',
  'dark tranquillity', 'dimmu borgir', 'darkthrone', 'down', 'dr. feelgood', 'dr feelgood',
  'doves', 'del amitri', 'deacon blue', 'datsuns', 'dead meadow',

  // T
  'tangerine dream', 'talking heads', 'tears for fears', 'talk talk', 'thin lizzy', 'tool',
  't. rex', 't rex', 'taking back sunday', 'tame impala', 'teenage fanclub', 'television',
  'the velvet underground', 'the rolling stones', 'the beatles', 'the who', 'the kinks',
  'the doors', 'the clash', 'the cure', 'the smiths', 'the police', 'the beach boys',
  'the byrds', 'the yardbirds', 'the zombies', 'the animals', 'the monkees', 'the stooges',
  'the ramones', 'the replacements', 'the strokes', 'the white stripes', 'the black keys',
  'the killers', 'the national', 'the shins', 'the postal service', 'the war on drugs',
  'the decemberists', 'the flaming lips', 'the chemical brothers', 'the prodigy', 'the fall',
  'the specials', 'the jam', 'the stranglers', 'the damned', 'the buzzcocks', 'the cramps',
  'the psychedelic furs', 'the waterboys', 'the pogues', 'the chameleons', 'the mission',
  'the sisters of mercy', 'the cult', 'the church', 'the go-betweens', 'the undertones',
  'three days grace', 'third eye blind', 'twenty one pilots', 'texas is the reason',

  // P
  'pink floyd', 'pearl jam', 'pixies', 'porcupine tree', 'portishead', 'pet shop boys',
  'public image ltd', 'public enemy', 'primal scream', 'pulp', 'placebo', 'pavement',
  'prefab sprout', 'panic! at the disco', 'paramore', 'pennywise', 'prophets of rage',
  'queens of the stone age', 'queensrÿche', 'queensryche', 'quiet riot',

  // L
  'led zeppelin', 'lynyrd skynyrd', 'linkin park', 'limp bizkit', 'living colour',
  'level 42', 'lightning seeds', 'lush', 'lcd soundsystem', 'los lobos',

  // B
  'black sabbath', 'black flag', 'bad religion', 'bad brains', 'bad company', 'bad news',
  'blue oyster cult', 'blind faith', 'blind guardian', 'blood brothers', 'bloc party',
  'blur', 'blink-182', 'blink 182', 'bowling for soup', 'breaking benjamin', 'bullet for my valentine',
  'built to spill', 'butthole surfers', 'buena vista social club', 'boards of canada',
  'belle and sebastian', 'bauhaus', 'big star', 'big thief', 'black country, new road',
  'black midi', 'black rebel motorcycle club', 'black crowes', 'the black crowes',

  // F
  'fleetwood mac', 'foo fighters', 'faith no more', 'fall out boy', 'fugazi',
  'franz ferdinand', 'flogging molly', 'fontaines d.c.', 'fontaines dc', 'futureheads',
  'fugees', 'fear factory',

  // G
  'guns n\' roses', 'guns n roses', 'grateful dead', 'green day', 'gentle giant',
  'guided by voices', 'gorillaz', 'garbage', 'godspeed you! black emperor',
  'godsmack', 'gojira', 'grandaddy', 'grizzly bear', 'gang of four', 'golden earring',

  // I
  'in flames', 'iron maiden', 'inxs', 'interpol', 'incubus', 'isley brothers', 'idles',
  'in this moment', 'iron butterfly', 'insane clown posse',

  // J
  'judas priest', 'joy division', 'jane\'s addiction', 'jethro tull', 'jefferson airplane',
  'jefferson starship', 'jesus and mary chain', 'the jesus and mary chain', 'jimmy eat world',
  'jawbox', 'jurassic 5',

  // K
  'king crimson', 'kraftwerk', 'korn', 'killswitch engage', 'kaiser chiefs', 'kasabian',
  'king gizzard & the lizard wizard', 'king gizzard and the lizard wizard', 'kyuss',
  'killing joke', 'krokus', 'kreator',

  // M
  'massive attack', 'motörhead', 'motorhead', 'my bloody valentine', 'my chemical romance',
  'manic street preachers', 'modest mouse', 'mott the hoople', 'morbid angel',
  'mudhoney', 'melvins', 'marillion', 'mastodon', 'matchbox twenty', 'maroon 5',
  'midnight oil', 'men at work', 'mumford & sons', 'mumford and sons', 'meat puppets',
  'minor threat', 'minutemen', 'mogwai', 'modern english', 'modern lovers',

  // N
  'new order', 'nine inch nails', 'neutral milk hotel', 'new found glory',
  'nightwish', 'neurosis', 'napalm death', 'nofx',

  // O
  'oasis', 'orchestral manoeuvres in the dark', 'omd', 'opeth', 'offspring', 'the offspring',
  'outkast', 'overkill', 'of montreal',

  // R
  'radiohead', 'rage against the machine', 'red hot chili peppers', 'r.e.m.', 'rem',
  'roxy music', 'rammstein', 'rancid', 'refused', 'ride', 'real estate', 'russian circles',

  // S
  'smashing pumpkins', 'the smashing pumpkins', 'soundgarden', 'stone temple pilots',
  'simple minds', 'steely dan', 'sonic youth', 'slowdive', 'spiritualized',
  'stone roses', 'the stone roses', 'stereophonics', 'snow patrol', 'starsailor',
  'supergrass', 'soft cell', 'spandau ballet', 'style council', 'the style council',
  'siouxsie and the banshees', 'sisters of mercy', 'social distortion', 'strung out',
  'sum 41', 'system of a down', 'slipknot', 'slayer', 'sepultura', 'soilwork',
  'stratovarius', 'symphony x', 'sunn o)))', 'sigur rós', 'sigur ros', 'spoon',
  'sunny day real estate', 'screaming trees', 'silverchair', 'spiderbait',

  // U, V, W, Y, Z
  'u2', 'ub40', 'uriah heep', 'vampire weekend', 'violent femmes', 'vaya con dios',
  'velvet revolver', 'weezer', 'white zombie', 'within temptation', 'wishbone ash',
  'wire', 'warrant', 'winger', 'whitesnake', 'xxxtentacion', 'yes', 'zz top'
]);

// Classical composers where surname should come first
const CLASSICAL_COMPOSERS: Record<string, string> = {
  'johann sebastian bach': 'Bach, Johann Sebastian',
  'j.s. bach': 'Bach, Johann Sebastian',
  'ludwig van beethoven': 'Beethoven, Ludwig van',
  'wolfgang amadeus mozart': 'Mozart, Wolfgang Amadeus',
  'frederic chopin': 'Chopin, Frédéric',
  'frédéric chopin': 'Chopin, Frédéric',
  'johannes brahms': 'Brahms, Johannes',
  'pyotr ilyich tchaikovsky': 'Tchaikovsky, Pyotr Ilyich',
  'antonio vivaldi': 'Vivaldi, Antonio',
  'franz schubert': 'Schubert, Franz',
  'george frideric handel': 'Handel, George Frideric',
  'claude debussy': 'Debussy, Claude',
  'richard wagner': 'Wagner, Richard',
  'joseph haydn': 'Haydn, Joseph',
  'franz liszt': 'Liszt, Franz',
  'antonin dvorak': 'Dvořák, Antonín',
  'antonín dvořák': 'Dvořák, Antonín',
  'maurice ravel': 'Ravel, Maurice',
  'gustav mahler': 'Mahler, Gustav',
  'igor stravinsky': 'Stravinsky, Igor',
  'giuseppe verdi': 'Verdi, Giuseppe',
  'felix mendelssohn': 'Mendelssohn, Felix',
  'richard strauss': 'Strauss, Richard',
  'johann strauss': 'Strauss, Johann',
  'jean sibelius': 'Sibelius, Jean',
  'sergei rachmaninoff': 'Rachmaninoff, Sergei',
  'sergei prokofiev': 'Prokofiev, Sergei',
  'dmitri shostakovich': 'Shostakovich, Dmitri',
  'edvard grieg': 'Grieg, Edvard',
  'bela bartok': 'Bartók, Béla',
  'béla bartók': 'Bartók, Béla'
};

/**
 * Deterministically analyzes an artist name using music library conventions.
 */
export function determineArtistSortName(rawArtist: string): ArtistSortResult {
  const artist = (rawArtist || '').trim();
  if (!artist) {
    return { artist: '', sort_name: '', isGroup: false, groupChar: '#', reason: 'Empty name' };
  }

  const lower = artist.toLowerCase();

  // 1. Check for Various Artists
  if (lower === 'various artists' || lower === 'various' || lower === 'soundtrack' || lower === 'v/a' || lower === 'va') {
    return {
      artist,
      sort_name: 'Various Artists',
      isGroup: true,
      groupChar: 'V',
      reason: 'Various Artists collection'
    };
  }

  // 2. Classical Composers
  if (CLASSICAL_COMPOSERS[lower]) {
    const sort_name = CLASSICAL_COMPOSERS[lower];
    const groupChar = sort_name.charAt(0).toUpperCase();
    return {
      artist,
      sort_name,
      isGroup: false,
      groupChar,
      reason: 'Classical composer'
    };
  }

  // 3. Already formatted as "Surname, Firstname"
  if (artist.includes(',')) {
    const cleanSort = artist.replace(/^the\s+/i, '').trim();
    const firstLetter = cleanSort.charAt(0).toUpperCase();
    return {
      artist,
      sort_name: artist,
      isGroup: false,
      groupChar: /[A-Z]/.test(firstLetter) ? firstLetter : '#',
      reason: 'Already formatted as Surname, Firstname'
    };
  }

  // 4. Check known bands dictionary
  if (KNOWN_BANDS.has(lower)) {
    // Strip leading "The " for sort_name letter grouping
    let clean = artist;
    if (/^the\s+/i.test(clean)) {
      clean = clean.replace(/^the\s+/i, '');
    }
    const groupChar = clean.charAt(0).toUpperCase();
    return {
      artist,
      sort_name: clean,
      isGroup: true,
      groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
      reason: 'Recognized band/group'
    };
  }

  // 5. Starts with "The " (e.g. The Chemical Brothers, The Horrors) -> Band
  if (/^the\s+/i.test(artist)) {
    const clean = artist.replace(/^the\s+/i, '').trim();
    const groupChar = clean.charAt(0).toUpperCase();
    return {
      artist,
      sort_name: clean,
      isGroup: true,
      groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
      reason: 'Begins with "The" (Musical Group)'
    };
  }

  // 6. Mononyms / Single word names (e.g. Prince, Madonna, Sting)
  const words = artist.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const char = artist.charAt(0).toUpperCase();
    return {
      artist,
      sort_name: artist,
      isGroup: MONONYMS.has(lower) ? false : false,
      groupChar: /[A-Z]/.test(char) ? char : '#',
      reason: 'Single name / mononym'
    };
  }

  // 7. Check for Solo Artist with Backing Band (e.g., "Bruce Springsteen & The E Street Band")
  const soloWithBandMatch = artist.match(/^([^&]+?)\s+(?:&|and|with)\s+(?:the\s+)?(.+)$/i);
  if (soloWithBandMatch) {
    const leadPerson = soloWithBandMatch[1].trim();
    const backing = soloWithBandMatch[2].trim();
    const leadWords = leadPerson.split(/\s+/);

    // If the lead person has 2 words (e.g., Bruce Springsteen, Nick Cave, Tom Petty)
    if (leadWords.length === 2 && !KNOWN_BANDS.has(leadPerson.toLowerCase())) {
      const surname = leadWords[1];
      const firstname = leadWords[0];
      const sort_name = `${surname}, ${firstname} & The ${backing}`;
      const groupChar = surname.charAt(0).toUpperCase();
      return {
        artist,
        sort_name,
        isGroup: false,
        groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
        reason: 'Solo artist with backing group'
      };
    }
  }

  // 8. Contains band keywords (e.g. "Orchestra", "Band", "Trio", "Brothers", "Project")
  const containsBandWord = BAND_KEYWORDS.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(artist);
  });

  if (containsBandWord) {
    const clean = artist.replace(/^the\s+/i, '').trim();
    const groupChar = clean.charAt(0).toUpperCase();
    return {
      artist,
      sort_name: clean,
      isGroup: true,
      groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
      reason: 'Contains musical group keyword'
    };
  }

  // 9. Standard 2-word artist: Check if second word is a known suffix (like Jr.) or looks like band
  if (words.length === 2) {
    const [first, last] = words;
    // Jr., Sr., II, III -> Band or special (e.g. Dinosaur Jr.)
    if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last)) {
      const char = first.charAt(0).toUpperCase();
      return {
        artist,
        sort_name: artist,
        isGroup: true,
        groupChar: /[A-Z]/.test(char) ? char : '#',
        reason: 'Suffix title (e.g. Dinosaur Jr.)'
      };
    }

    // Default 2-word individual: Surname, Firstname (e.g. David Bowie -> Bowie, David)
    const surname = last;
    const firstname = first;
    const sort_name = `${surname}, ${firstname}`;
    const groupChar = surname.charAt(0).toUpperCase();
    return {
      artist,
      sort_name,
      isGroup: false,
      groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
      reason: 'Individual (Surname, Firstname)'
    };
  }

  // 10. For 3+ words, check if last word is a surname or if it looks like a group
  // e.g. "Stevie Ray Vaughan" -> Vaughan, Stevie Ray
  // e.g. "Creedence Clearwater Revival" -> Revival is caught above
  const lastPart = words[words.length - 1];
  const firstParts = words.slice(0, -1).join(' ');

  // If last part is numeric (e.g. Jurassic 5)
  if (/^\d+$/.test(lastPart)) {
    const char = artist.charAt(0).toUpperCase();
    return {
      artist,
      sort_name: artist,
      isGroup: true,
      groupChar: /[A-Z]/.test(char) ? char : '#',
      reason: 'Numbered group'
    };
  }

  // Default assumption for 3 words (often middle name/initial e.g. Stevie Ray Vaughan, John Lee Hooker)
  const sort_name = `${lastPart}, ${firstParts}`;
  const groupChar = lastPart.charAt(0).toUpperCase();
  return {
    artist,
    sort_name,
    isGroup: false,
    groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
    reason: 'Multi-part person name'
  };
}

/**
 * Ask Gemini AI to batch-analyze artists with library archivist precision.
 */
export async function batchNormalizeWithGemini(artists: string[]): Promise<Record<string, ArtistSortResult>> {
  const results: Record<string, ArtistSortResult> = {};
  
  // Pre-fill with deterministic engine
  artists.forEach(a => {
    results[a] = determineArtistSortName(a);
  });

  const apiKey = process.env.API_KEY;
  if (!apiKey || artists.length === 0) {
    return results;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Process in batches of 30 to stay well within token limits and maintain quality
    const BATCH_SIZE = 30;
    for (let i = 0; i < artists.length; i += BATCH_SIZE) {
      const batch = artists.slice(i, i + BATCH_SIZE);
      const prompt = `You are an expert music archivist and librarian cataloger.
For each music artist in this list, determine if they are a BAND / MUSICAL GROUP or an INDIVIDUAL / SOLO ARTIST.
Format their official library "sort_name" following standard record store / library catalog rules:

RULES:
1. BANDS/GROUPS (e.g., Dire Straits, Def Leppard, Tangerine Dream, Dinosaur Jr., Fleetwood Mac, Pink Floyd, The Clash):
   sort_name MUST remain the band name. If it begins with "The ", strip "The " for sorting (e.g. "The Clash" -> "Clash"). DO NOT reverse words in band names.
2. INDIVIDUAL SOLO ARTISTS (e.g., David Bowie, Kate Bush, Bruce Springsteen, Neil Young, Michael Jackson):
   sort_name MUST be "Surname, First Name" (e.g. "Bowie, David", "Bush, Kate", "Springsteen, Bruce").
3. SOLO ARTIST WITH BACKING BAND (e.g., Tom Petty and the Heartbreakers, Nick Cave & The Bad Seeds):
   sort_name MUST be "Surname, First Name & The [Band]" (e.g. "Petty, Tom & The Heartbreakers").
4. MONONYMS / STAGE MONIKERS (e.g., Prince, Madonna, Cher, Sting, Bjork, Beck, Seal):
   sort_name is the moniker as-is (e.g. "Prince").

Artists to catalog:
${JSON.stringify(batch)}

Respond ONLY with a JSON array of objects with these keys:
- "artist": exact string from input
- "is_group": boolean (true if band/group/ensemble, false if individual solo artist)
- "sort_name": string (the exact formatted sort name)
- "sort_letter": single uppercase character A-Z or # for the alphabet section`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json'
        }
      });

      const text = response.text || '';
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item && item.artist && item.sort_name) {
              const letter = (item.sort_letter || item.sort_name.charAt(0)).toUpperCase();
              results[item.artist] = {
                artist: item.artist,
                sort_name: item.sort_name,
                isGroup: Boolean(item.is_group),
                groupChar: /[A-Z]/.test(letter) ? letter : '#',
                reason: item.is_group ? 'AI verified band/group' : 'AI verified solo artist'
              };
            }
          });
        }
      } catch (err) {
        console.warn("Failed to parse Gemini response as JSON for artist batch:", err);
      }
    }
  } catch (error) {
    console.warn("Gemini batch artist classification encountered an issue, using deterministic results:", error);
  }

  return results;
}

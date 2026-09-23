export default {
  // Availability — WHERE a title came out, and what a request can hope for.
  // Never use "Available" here: on My Requests it already means the title is
  // downloaded and sitting in the library. Name the channel (theaters, online,
  // Blu-ray), never a state of ownership.
  availStillInTheaters: "Still in theaters",
  availInTheaters: "In theaters",
  availInTheatersLong: "Still in theaters since {{date}}",
  availTheatricalSoon: "In theaters {{date}}",
  availTheatricalSoonLong: "Theatrical release on {{date}}",
  availDigitalOut: "Streaming",
  availDigitalOutLong: "Released for streaming on {{date}}",
  availOnlineOn: "Streaming {{date}}",
  availOnlineOnLong: "Streaming release on {{date}}",
  // On a subscription platform right now, with no known release date: often
  // all we know about a running series or anime.
  availStreamingNow: "Streaming",
  availStreamingNowLong: "Watchable on a subscription platform",
  // No known release anywhere. Say so rather than leave a silent card, which
  // reads as an oversight rather than as missing information.
  availUncharted: "Possibly obtainable",
  availUnchartedLong:
    "No known theatrical or streaming release — a request may still succeed",
  availPhysicalOut: "On Blu-ray",
  availPhysicalOutLong: "Released on DVD / Blu-ray on {{date}}",
  availPhysicalSoon: "Blu-ray {{date}}",
  availPhysicalSoonLong: "DVD / Blu-ray release on {{date}}",
  availReleaseOn: "Out {{date}}",
  availReleaseOnLong: "Not released yet — due {{date}}",
  availAirsOn: "Airs {{date}}",
  availAirsOnLong: "First airs on {{date}}",
  availNotAiredYet: "Has not started airing",
  // Odds of success, never a number and never a promise.
  availOutlookLikely: "A release exists: this request has a good chance of completing.",
  availOutlookUnlikely: "Theaters only for now: a release is unlikely to be circulating yet.",
  availOutlookNotYet: "Nothing is out yet: the request will stay pending until then.",
  availRequestAnyway: "Request anyway",
  availRequestAnywayHint:
    "Nothing can arrive before release. The request will stay pending until then.",

  // Real download progress
  progressRemaining: "≈ {{eta}} left",
  progressPaused: "Paused",
  // The file is complete but not yet filed into the library.
  // Short in the chip, which shares its line with a truncated title.
  statusValidating: "Validating",
  progressValidating: "Arrived — checking and importing",

  // Server download queue (administrators)
  downloadsTab: "Server queue",
  downloadsSubtitle:
    "The Sonarr and Radarr queue: everything the server is fetching, everyone's requests included.",
  downloadsEmpty: "Nothing coming down right now",
  downloadsUnreachable: "{{service}} is not responding — this list may be incomplete",
  progressSearching: "Looking for a source",
  progressEpisodes_one: "{{count}} episode in progress",
  progressEpisodes_other: "{{count}} episodes in progress",
  // Per-season breakdown of a series request
  // Real air time of an episode, when Sonarr tracks the series
  episodeAirTime: "{{date}} · {{time}}",
  progressSeason: "Season {{season}}",
  progressSeasonWaiting: "Waiting",
  progressNoSeason: "Outside a season",

  // Calendar page. Labels state what each view SHOWS: "Releases" everywhere
  // (page, tab…) hinted at nothing and told the tabs apart even less.
  navReleases: "Calendar",
  releasesTitle: "Calendar",
  releasesSubtitle: "Release dates for your requests and across all platforms",
  releasesTabPersonal: "My requests",
  releasesOnlyRequested: "Requested only",
  // Every calendar for the period, unrequested content included.
  releasesTabAll: "All releases",
  releasesScopeUpcoming: "All my requests",
  releasesScopeAll: "All requests",
  // States plainly what the shared view shows: what other people requested.
  releasesEveryoneHint: "Requests from every user on this server.",
  releasesEmptyEveryone: "No upcoming releases among the server's requests",
  releasesViewWeek: "Week",
  releasesViewMonth: "Month",
  releasesEmptyPersonal: "No upcoming releases among your requests",
  releasesEmptyPersonalHint: "Titles already in your library are not listed here.",
  releasesEmptyGlobal: "No releases announced for this period",
  releasesPartial: "Loading dates…",
  // First build of the shared calendar: say what is happening, not just "wait".
  releasesBuilding: "Building the calendar — releases fill in as they load.",
  // Calendar filters — several platforms at once
  releasesFiltersTitle: "Release filters",
  filterType: "Type",
  releasesFilterPlatformsHint: "A release shows up if at least one ticked platform carries it.",
  releasesEmptyFiltered: "No releases on the selected platforms",
  releasesEmptyFilteredHint:
    "A title that is not out yet is carried by no platform, so it does not show here.",
  releasesShowResults_one: "Show {{count}} release",
  releasesShowResults_other: "Show {{count}} releases",
  releasesFilterAll: "All",
  releasesFilterMovies: "Movies",
  releasesFilterTv: "TV",
  releasesToday: "Today",
  releasesTomorrow: "Tomorrow",
  releasesThisMonth: "This month",
  releasesKindDigital: "Streaming",
  releasesKindTheatrical: "In theaters",
  releasesKindPhysical: "Blu-ray / DVD",
  releasesKindEpisode: "Episode",
  releasesKindPremiere: "Release",
  releasesRequested: "Requested",

  // Streaming platforms — "where can I already watch it"
  streamingOn: "Streaming on {{platforms}}",
  streamingLabel: "Watch on",
  streamingNone: "On no subscription platform",
  releasesCount_one: "{{count}} release",
  releasesCount_other: "{{count}} releases",
  releasesMonthPrev: "Previous month",
  releasesMonthNext: "Next month",
  releasesWeekPrev: "Previous week",
  releasesWeekNext: "Next week",
  releasesThisWeek: "This week",
  releasesWindow30: "30 days",
  releasesWindow90: "3 months",
  releasesWindow180: "6 months",
} as const;

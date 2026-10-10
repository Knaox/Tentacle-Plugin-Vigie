export default {
  // Profiles
  profileLabel: "Quality profile",
  profileDefault: "Default",
  profilesTitle: "Quality Profiles",
  profileAdd: "Add profile",
  profilesEmpty: "No profiles configured — Jellyseerr defaults will be used",
  profileNamePlaceholder: "Profile name (e.g. Full HD, 4K HDR...)",
  profileTarget: "Target media type",
  profileTags: "Custom tags",
  profileTagsHint: "If tags are selected, they will replace the default tags on the request",
  profileTagManual: "Tag ID...",

  // Config
  statusConnected: "Connected",
  statusError: "Error",
  statusTesting: "Testing...",
  statusNotConfigured: "Not configured",
  urlLabel: "Your Jellyseerr / Overseerr URL",
  urlPlaceholder: "https://seerr.example.com",
  testButton: "Test",
  apiKeyLabel: "API Key",
  apiKeyPlaceholder: "Jellyseerr / Overseerr API key",
  toggleEnabled: "Enable Vigie",
  toggleEnabledDesc: "Shows the tab in Tentacle and lets people make requests",
  toggleAutoApprove: "Approve automatically",
  toggleAutoApproveDesc: "A request from an account without approval rights in Jellyseerr is approved as soon as it is sent",
  toggleMaskedRequests: "Allow requesting hidden content",
  toggleMaskedRequestsDesc: "A title Jellyseerr hides (blocklist, blocked keywords) can be requested: Vigie removes it from the blocklist right before sending the request",
  admSpecialSeasons: "Special episodes",
  admSpecialSeasonsDesc: "Season 0 can be requested when Jellyseerr allows it (Settings › General › allow special episodes requests)",
  admSpecialSeasonsOn: "Allowed",
  admSpecialSeasonsOff: "Not allowed",
  saving: "Saving...",
  save: "Save",
  configSaveError: "Error saving configuration",

  // Reassign request ownership
  adminReassignButton: "Sync local requests",
  adminReassignHint: "Walks through every local request, checks the owner on Jellyseerr and fixes it if wrong. Creates a placeholder Jellyseerr user if the Jellyfin account was removed — their history will be linked back when they recreate the account with the same username.",
  adminReassignDone: "{{reassigned}} reassigned, {{recreated}} recreated, {{orphansCreated}} placeholder(s), {{alreadyOk}} already OK, {{failed}} failed",

  // Manually mark Jellyseerr media status
  markAs: "Mark as",
  markAsAvailable: "Available",
  markAsPartial: "Partially available",
  markAsUnknown: "Requested",
  markAsProcessing: "Processing",
  markedSuccess: "Jellyseerr status updated",
  markedError: "Failed to update status",

  // Destructive options on delete/retry
  deleteAlsoFiles: "Also delete content (Sonarr/Radarr)",
  deleteAlsoFilesHint: "Unchecked: monitoring is turned off (Sonarr/Radarr stop fetching it), content already there is kept. Checked: files are deleted too. The series/movie is never removed from Sonarr/Radarr.",
  forceRedownload: "Force a fresh fetch",
  forceRedownloadHint: "Unchecked: simply re-trigger the request in Jellyseerr. Checked: delete existing media and re-request.",
} as const;

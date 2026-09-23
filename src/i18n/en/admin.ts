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
  configTitle: "Vigie Configuration",
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
  toggleEnabledDesc: "Enable the media requests plugin",
  toggleAutoApprove: "Auto-approval",
  toggleAutoApproveDesc: "Automatically approve requests",
  userLimitLabel: "Limit per user (0 = unlimited)",
  saving: "Saving...",
  save: "Save",
  connectionSuccess: "Connection successful",
  connectionFailed: "Connection failed",
  connectionUnreachable: "Unable to reach server",
  configSaved: "Configuration saved",
  configSaveError: "Error saving configuration",
  networkError: "Network error",

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

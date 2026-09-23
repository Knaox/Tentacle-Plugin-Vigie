export default {
  pluginName: "Vigie — Media Requests",
  pluginDescription: "Request movies and TV series, track them arriving, and see what's coming out. Connects to your own Jellyseerr / Overseerr instance — independent project, not affiliated with Jellyseerr.",
  notAffiliated: "Vigie is an independent plugin, unaffiliated with the Jellyseerr and Overseerr projects.",
  notAffiliatedLink: "Official Jellyseerr project",

  // Navigation — "Catalog" rather than "Discover": this is where you find what
  // is NOT yet in the library, and request it.
  navDiscover: "Catalog",
  navRequests: "My Requests",
  navMyRequests: "My Requests",
  navConfig: "Vigie Configuration",
  navSeer: "Vigie",
  navNotifications: "Notifications",
  navStats: "Statistics",

  // Media types
  typeMovie: "Movie",
  typeSeries: "Series",
  typeAnime: "Anime",
  untitled: "Untitled",
  noImage: "No image",

  // Statuses
  statusQueued: "Pending",
  statusProcessing: "Processing",
  statusRequested: "Requested",
  statusSentToSeer: "Sent",
  statusApproved: "Approved",
  statusDownloading: "On its way",
  statusAvailable: "Available",
  statusPartiallyAvailableBadge: "Partially avail.",
  statusRetryPending: "Retrying",
  statusUnavailable: "Requested",
  statusFailed: "Failed",
  statusDeleting: "Deleting",
  statusDeleteFailed: "Delete Failed",
  statusDeleted: "Deleted",
  statusCancelled: "Cancelled",
  status_queued: "Pending",
  status_processing: "Processing",
  status_sent_to_seer: "Sent",
  status_approved: "Approved",
  status_downloading: "On its way",
  status_partially_available: "Partially available",
  status_available: "Available",
  status_retry_pending: "Retrying",
  status_unavailable: "Requested",
  status_failed: "Failed",
  status_deleting: "Deleting",
  status_delete_failed: "Delete Failed",
  status_deleted: "Deleted",

  // Status badges (for media cards)
  statusPending: "Pending",
  statusPartiallyAvailable: "Partial",
} as const;

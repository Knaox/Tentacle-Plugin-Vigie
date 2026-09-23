export { seerPlugin } from "./plugin";
export { setSeerBackendUrl } from "./api/endpoints";

// Re-export types for consumers
export type {
  SeerrSearchResult,
  SeerrPagedResponse,
  SeerrMediaRequest,
  SeerrRequestsResponse,
  SeerrMovieDetail,
  SeerrTvDetail,
  SeerrSeason,
  SeerrCastMember,
  SeerrCrewMember,
  SeerrRequestStatus,
  DiscoverMediaType,
  DiscoverFilters,
  SortOption,
  SortOrder,
  TvStatus,
  MediaType,
  LocalRequest,
  LocalRequestsResponse,
  QueueStatus,
  RequestStatus,
} from "./api/types";

// Re-export hooks
export { useMyRequests, useDeleteRequest } from "./hooks/useRequests";
export { useRequestMedia } from "./hooks/useRequestMedia";
export { useMediaDetail } from "./hooks/useMediaDetail";
export { useRichTrailers } from "./hooks/useRichTrailers";
export { useTvSeasonEpisodes } from "./hooks/useTvSeasonEpisodes";
export { useMediaSimilar } from "./hooks/useMediaSimilar";
export { useWatchProviders } from "./hooks/useWatchProviders";

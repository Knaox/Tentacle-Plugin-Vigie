export interface StreamingPlatform {
  id: number;
  name: string;
}

// TMDB provider IDs — verified against themoviedb.org watch pages (FR region)
export const PLATFORMS: StreamingPlatform[] = [
  { id: 8, name: "Netflix" },
  { id: 337, name: "Disney+" },
  { id: 119, name: "Amazon Prime Video" },
  { id: 283, name: "Crunchyroll" },
  { id: 350, name: "Apple TV+" },
  { id: 531, name: "Paramount+" },
  { id: 1899, name: "Max" },
  { id: 415, name: "ADN" },
  { id: 56, name: "OCS" },
  { id: 381, name: "Canal+" },
  { id: 236, name: "Arte" },
];

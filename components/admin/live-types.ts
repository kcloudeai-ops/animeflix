/** İstemci-güvenli canlı akış tipleri (queries.ts server-only olduğu için). */
export interface CanliPage {
  path: string;
  aktif: number;
}
export interface CanliVisit {
  path: string;
  session_id: string;
  duration_sec: number;
  created_at: string;
}
export interface CanliAkisSonuc {
  sayfalar: CanliPage[];
  son: CanliVisit[];
}

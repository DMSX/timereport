export function secureSupabaseUrl(value: string) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("Supabase benötigt HTTPS. HTTP ist nur für lokale Entwicklung erlaubt.");
  }
  return value;
}

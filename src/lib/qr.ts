export function encodeQrImage(source: string) {
  const prefix = "data:image/svg+xml;utf-8,";
  if (!source.startsWith(prefix)) throw new Error("Ungültiges Authenticator-QR-Bild.");
  return prefix + encodeURIComponent(source.slice(prefix.length));
}

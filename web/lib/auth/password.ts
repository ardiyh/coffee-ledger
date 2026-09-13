import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/** Format tersimpan: "<saltHex>:<hashHex>". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Gagal aman: format yang gak dikenal, atau panjang buffer yang gak cocok
 * (jadi timingSafeEqual gak akan dipanggil dengan panjang beda -- itu
 * melempar, bukan mengembalikan false), keduanya dianggap password salah.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

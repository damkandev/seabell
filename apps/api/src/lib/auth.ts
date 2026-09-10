import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * 1024 * 1024;
const SESSION_TOKEN_BYTES = 32;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEM }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "seabell_session";

export const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$87xuP_zsviL_8xlYE4GGdN5CefEvk9cTaJi8aTN_W93HjYfwLqp9zNpi6WxxRJHq5-2MjYVQYA-ziEFf-XFU1Q";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string) {
  return password.length >= 12 && password.length <= 256;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt);

  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), derivedKey.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, n, r, p, encodedSalt, encodedKey] = encodedHash.split("$");
  if (algorithm !== "scrypt" || n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P)) return false;

  const salt = Buffer.from(encodedSalt ?? "", "base64url");
  const expectedKey = Buffer.from(encodedKey ?? "", "base64url");
  if (salt.length !== 16 || expectedKey.length !== KEY_LENGTH) return false;

  const derivedKey = await deriveKey(password, salt);

  return timingSafeEqual(derivedKey, expectedKey);
}

export function createSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

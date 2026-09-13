#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Pakai: node scripts/hash-password.mjs "password-baru"');
  process.exit(1);
}

const KEY_LENGTH = 64;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, KEY_LENGTH);

console.log(`${salt.toString("hex")}:${hash.toString("hex")}`);

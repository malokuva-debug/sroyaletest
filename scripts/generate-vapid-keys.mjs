/**
 * Run once to generate VAPID keys:
 *   node scripts/generate-vapid-keys.mjs
 *
 * It appends three env vars to dashboard/.env.local:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL
 */
import { webcrypto } from 'node:crypto';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

const keyPair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);

// Public key: raw uncompressed EC point (65 bytes: 0x04 || x || y)
const publicKey = Buffer.from(
  await webcrypto.subtle.exportKey('raw', keyPair.publicKey)
).toString('base64url');

// Private key: use JWK format to reliably extract the raw scalar (d)
// Node.js v24 PKCS8 DER includes the public key attribute, making
// subarray(length-32) extract the wrong bytes.
const jwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
const privateKey = jwk.d;

const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

const lines = [];
if (!existing.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY')) {
  lines.push(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
}
if (!existing.includes('VAPID_PRIVATE_KEY')) {
  lines.push(`VAPID_PRIVATE_KEY=${privateKey}`);
}
if (!existing.includes('VAPID_EMAIL')) {
  lines.push(`VAPID_EMAIL=mailto:valmir.mlku@gmail.com`);
}

if (lines.length === 0) {
  console.log('VAPID keys already exist in .env.local — nothing to do.');
} else {
  appendFileSync(envPath, '\n' + lines.join('\n') + '\n');
  console.log('VAPID keys written to .env.local');
  console.log('  Public key:', publicKey.slice(0, 12) + '...');
  console.log('');
  console.log('Restart the dev server for env vars to take effect.');
}

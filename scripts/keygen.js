// Generate a pinned Ed25519 signing key. Save the output to the password manager,
// then set SIGNING_KEY_PKCS8_B64 in Render. Never rotate it once live.
import crypto from 'node:crypto';
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const b64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const jwk = publicKey.export({ format: 'jwk' });
const kid = crypto.createHash('sha256').update(jwk.x).digest('hex').slice(0, 16);
console.log(`\nSIGNING_KEY_PKCS8_B64=${b64}\n\nkeyId (public, for reference): ${kid}\n`);

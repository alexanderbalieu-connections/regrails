// Ed25519 response signing. Key MUST be pinned via SIGNING_KEY_PKCS8_B64 or it
// regenerates on every deploy and every previously issued signature stops verifying.
import crypto from 'node:crypto';

export class Signer {
  constructor(b64) {
    this.ephemeral = !b64;
    if (b64) {
      this.key = crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' });
    } else {
      this.key = crypto.generateKeyPairSync('ed25519').privateKey;
    }
    this.pub = crypto.createPublicKey(this.key);
    const jwk = this.pub.export({ format: 'jwk' });
    this.keyId = crypto.createHash('sha256').update(jwk.x).digest('hex').slice(0, 16);
    this.jwk = { ...jwk, kid: this.keyId, use: 'sig', alg: 'EdDSA' };
  }
  sign(payload) {
    const h = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: this.keyId })).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const s = crypto.sign(null, Buffer.from(`${h}.${p}`), this.key).toString('base64url');
    return `${h}.${p}.${s}`;
  }
  wellKnown() { return { keys: [this.jwk], ephemeral: this.ephemeral }; }
}

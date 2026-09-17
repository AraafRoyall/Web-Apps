(function(global){
  "use strict";

  const te = new TextEncoder();
  const td = new TextDecoder();
  const VERSION = 2;
  const RAW_LEN = 32;
  const IV_LEN = 12;
  const AES_KEY_LEN = 32;
  const MAGIC = new Uint8Array([69,67,73,52]);
  const AAD = te.encode("ECIES");
  const KDF_INFO = te.encode("ECIES-X25519-AESGCM");
  const ZERO_SALT = new Uint8Array(32);
  const OID_X25519 = new Uint8Array([0x2b,0x65,0x6e]);

  const concat = (...parts) => {
    let len = 0;
    for (const part of parts) len += part.length;
    const out = new Uint8Array(len);
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  };

  const toBase64Url = bytes => {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  };

  const fromBase64Url = value => {
    let str = String(value || "").trim().replace(/\s+/g,"").replace(/-/g,"+").replace(/_/g,"/");
    while (str.length % 4) str += "=";
    const bin = atob(str), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const derLength = len => {
    if (len < 128) return new Uint8Array([len]);
    const a = [];
    while (len > 0) { a.unshift(len & 255); len >>= 8; }
    return new Uint8Array([0x80 | a.length, ...a]);
  };
  const derTag = (tag, content) => concat(new Uint8Array([tag]), derLength(content.length), content);
  const derSeq = (...items) => derTag(0x30, concat(...items));
  const derInt = n => derTag(0x02, new Uint8Array([n]));
  const derOid = bytes => derTag(0x06, bytes);
  const derBitString = bytes => derTag(0x03, concat(new Uint8Array([0]), bytes));
  const derOctet = bytes => derTag(0x04, bytes);

  const spkiFromRaw = raw => derSeq(derSeq(derOid(OID_X25519)), derBitString(raw));
  const pkcs8FromRaw = raw => derSeq(derInt(0), derSeq(derOid(OID_X25519)), derOctet(derOctet(raw)));

  const readDerLength = (buf, offset) => {
    const first = buf[offset];
    if (first < 0x80) return {len:first,next:offset + 1};
    const count = first & 0x7f;
    let len = 0;
    for (let i = 0; i < count; i++) len = (len << 8) | buf[offset + 1 + i];
    return {len,next:offset + 1 + count};
  };
  const readDer = (buf, offset) => {
    const tag = buf[offset], x = readDerLength(buf, offset + 1);
    return {tag,start:x.next,end:x.next + x.len,next:x.next + x.len};
  };

  const rawFromSpki = spki => {
    const seq = readDer(spki,0), alg = readDer(spki,seq.start), bit = readDer(spki,alg.next);
    if (seq.tag !== 0x30 || alg.tag !== 0x30 || bit.tag !== 0x03 || spki[bit.start] !== 0) throw new Error("Bad public key");
    const raw = spki.slice(bit.start + 1,bit.end);
    if (raw.length !== RAW_LEN) throw new Error("Bad public key length");
    return raw;
  };

  const rawFromPkcs8 = pkcs8 => {
    const seq = readDer(pkcs8,0), version = readDer(pkcs8,seq.start), alg = readDer(pkcs8,version.next), key = readDer(pkcs8,alg.next);
    if (seq.tag !== 0x30 || version.tag !== 0x02 || alg.tag !== 0x30 || key.tag !== 0x04) throw new Error("Bad private key");
    const inner = pkcs8.slice(key.start,key.end), oct = readDer(inner,0);
    if (oct.tag !== 0x04) throw new Error("Bad private key");
    const raw = inner.slice(oct.start,oct.end);
    if (raw.length !== RAW_LEN) throw new Error("Bad private key length");
    return raw;
  };

  const importPublic = raw => crypto.subtle.importKey("spki",spkiFromRaw(raw),{name:"X25519"},false,[]);
  const importPrivate = raw => crypto.subtle.importKey("pkcs8",pkcs8FromRaw(raw),{name:"X25519"},false,["deriveBits"]);

  const hmac = async (keyBytes,dataBytes) => {
    const key = await crypto.subtle.importKey("raw",keyBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC",key,dataBytes));
  };

  const deriveAesKey = async shared => {
    const prk = await hmac(ZERO_SALT,shared);
    const key = (await hmac(prk,KDF_INFO)).slice(0,AES_KEY_LEN);
    if (key.length !== AES_KEY_LEN) throw new Error("Failed to derive AES-256 key");
    return key;
  };

  const aesGcmEncrypt = async (plain,keyBytes,iv) => {
    if (keyBytes.length !== AES_KEY_LEN) throw new Error("AES-256 key required");
    const key = await crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt"]);
    return new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:AAD,tagLength:128},key,plain));
  };

  const aesGcmDecrypt = async (cipher,keyBytes,iv) => {
    if (keyBytes.length !== AES_KEY_LEN) throw new Error("AES-256 key required");
    const key = await crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["decrypt"]);
    return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:AAD,tagLength:128},key,cipher));
  };

  const generateKeyPair = async () => {
    const pair = await crypto.subtle.generateKey({name:"X25519"},true,["deriveBits"]);
    const publicSpki = new Uint8Array(await crypto.subtle.exportKey("spki",pair.publicKey));
    const privatePkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8",pair.privateKey));
    return {publicKey:rawFromSpki(publicSpki),privateKey:rawFromPkcs8(privatePkcs8)};
  };

  const encrypt = async (plainText,recipientPublicB64) => {
    const recipientRaw = fromBase64Url(recipientPublicB64);
    if (recipientRaw.length !== RAW_LEN) throw new Error("Public key must be 32 bytes");
    const recipient = await importPublic(recipientRaw);
    const ephemeral = await crypto.subtle.generateKey({name:"X25519"},true,["deriveBits"]);
    const ephSpki = new Uint8Array(await crypto.subtle.exportKey("spki",ephemeral.publicKey));
    const ephPublic = rawFromSpki(ephSpki);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({name:"X25519",public:recipient},ephemeral.privateKey,256));
    const aesKey = await deriveAesKey(shared);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const cipher = await aesGcmEncrypt(te.encode(plainText || ""),aesKey,iv);
    return toBase64Url(concat(MAGIC,new Uint8Array([VERSION]),ephPublic,iv,cipher));
  };

  const decrypt = async (cipherB64,privateB64) => {
    const all = fromBase64Url(cipherB64), privateRaw = fromBase64Url(privateB64);
    if (privateRaw.length !== RAW_LEN) throw new Error("Private key must be 32 bytes");
    let ephPublic,iv,cipher;
    if (all.length >= 65 && all[0]===69 && all[1]===67 && all[2]===73 && all[3]===52) {
      if (all[4] !== VERSION) throw new Error("Bad version");
      ephPublic=all.slice(5,37); iv=all.slice(37,49); cipher=all.slice(49);
    } else {
      if (all.length < 61 || all[0] !== 1) throw new Error("Invalid legacy payload");
      ephPublic=all.slice(1,33); iv=all.slice(33,45); cipher=all.slice(45);
    }
    if (ephPublic.length!==RAW_LEN || iv.length!==IV_LEN || cipher.length<16) throw new Error("Invalid payload");
    const ephKey = await importPublic(ephPublic), privateKey = await importPrivate(privateRaw);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({name:"X25519",public:ephKey},privateKey,256));
    const aesKey = await deriveAesKey(shared);
    return td.decode(await aesGcmDecrypt(cipher,aesKey,iv));
  };

  global.ECIES3Core = Object.freeze({VERSION,RAW_LEN,IV_LEN,AES_KEY_LEN,bytesToB64Url:toBase64Url,b64UrlToBytes:fromBase64Url,generateKeyPair,encrypt,decrypt});
})(window);
(function (global) {
  "use strict";

  const te = new TextEncoder();
  const td = new TextDecoder();
  const VERSION = 2;
  const IV_LEN = 12;
  const AAD = te.encode("AESv1");

  const deriveKey = async password => {
    if (!global.crypto || !global.crypto.subtle)
      throw new Error("Web Crypto API is unavailable.");

    const digest = await global.crypto.subtle.digest(
      "SHA-256",
      te.encode(String(password || ""))
    );

    return global.crypto.subtle.importKey(
      "raw", digest, {name:"AES-GCM"}, false, ["encrypt","decrypt"]
    );
  };

  const bytesToBase64Url = bytes => {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  };

  const base64UrlToBytes = value => {
    let str = String(value || "").trim()
      .replace(/\s+/g,"").replace(/-/g,"+").replace(/_/g,"/");
    while (str.length % 4) str += "=";
    const binary = atob(str);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  };

  const concat = (...parts) => {
    let total = 0;
    for (const part of parts) total += part.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  };

  const encrypt = async (text, password) => {
    const iv = global.crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await deriveKey(password);
    const cipher = new Uint8Array(await global.crypto.subtle.encrypt(
      {name:"AES-GCM", iv, additionalData:AAD, tagLength:128},
      key, te.encode(String(text || ""))
    ));
    return bytesToBase64Url(concat(new Uint8Array([VERSION]), iv, cipher));
  };

  const decrypt = async (value, password) => {
    const all = base64UrlToBytes(value);
    if (all.length < 1 + IV_LEN + 16) throw new Error("Invalid cipher text.");
    if (all[0] !== VERSION) throw new Error("Unsupported cipher version.");

    const iv = all.slice(1, 1 + IV_LEN);
    const cipher = all.slice(1 + IV_LEN);
    const key = await deriveKey(password);

    const plain = await global.crypto.subtle.decrypt(
      {name:"AES-GCM", iv, additionalData:AAD, tagLength:128},
      key, cipher
    );
    return td.decode(plain);
  };

  global.AES = Object.freeze({encrypt, decrypt});
})(window);

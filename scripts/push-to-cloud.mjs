#!/usr/bin/env node
/**
 * 将 dramas-import.json 加密并上传到 Cloudflare Worker
 * 用法: node scripts/push-to-cloud.mjs <同步码>
 */
import { readFileSync } from 'fs';
import { webcrypto } from 'crypto';

const apiUrl = 'https://drama-track-sync.oscar-802.workers.dev';
const syncCode = process.argv[2];

if (!syncCode || syncCode.length < 4) {
  console.error('用法: node scripts/push-to-cloud.mjs <同步码>');
  process.exit(1);
}

const dramas = JSON.parse(readFileSync(new URL('../dramas-import.json', import.meta.url), 'utf8'));
const subtle = webcrypto.subtle;
const enc = new TextEncoder();

async function hashSyncId(code) {
  const buf = await subtle.digest('SHA-256', enc.encode(code));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(code, syncId) {
  const salt = enc.encode(syncId.slice(0, 32));
  const keyMaterial = await subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function uint8ToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function encrypt(data, code, syncId) {
  const key = await deriveKey(code, syncId);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return uint8ToBase64(combined);
}

const syncId = await hashSyncId(syncCode);
const updatedAt = Date.now();
const encryptedData = await encrypt(dramas, syncCode, syncId);

const res = await fetch(`${apiUrl}/sync/${syncId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ encrypted_data: encryptedData, updated_at: updatedAt }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`上传失败 (${res.status}):`, text);
  process.exit(1);
}

console.log(`✅ 已上传 ${dramas.length} 部剧集到云端`);
console.log(`同步码: ${syncCode}`);
console.log(`请在 https://drama-track.pages.dev 的「同步」中输入相同同步码`);

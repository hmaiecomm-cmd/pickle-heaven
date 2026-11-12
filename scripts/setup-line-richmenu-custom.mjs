import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve('.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const token = (env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ?? '')
  .replace(/^['"]|['"]$/g, '')
  .match(/^[\x00-\x7F]+/)?.[0]
  .trim();
if (!token) throw new Error('Missing LINE_MESSAGING_CHANNEL_ACCESS_TOKEN in .env.local');

const imagePath = path.resolve('public/images/line-richmenu-six-buttons-v7.jpg');
const image = fs.readFileSync(imagePath);
const headers = { Authorization: `Bearer ${token}` };

const menu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: '大新店森林匹克球｜網站功能主選單',
  chatBarText: '開啟選單',
  areas: [
    { bounds: { x: 35, y: 915, width: 1300, height: 430 }, action: { type: 'uri', uri: 'https://pickle-heaven.vercel.app/booking' } },
    { bounds: { x: 1340, y: 915, width: 570, height: 430 }, action: { type: 'uri', uri: 'https://pickle-heaven.vercel.app/sessions' } },
    { bounds: { x: 1925, y: 915, width: 540, height: 430 }, action: { type: 'message', text: '我想了解教練課程' } },
    { bounds: { x: 100, y: 1360, width: 870, height: 240 }, action: { type: 'message', text: '我需要客戶服務' } },
    { bounds: { x: 980, y: 1360, width: 790, height: 240 }, action: { type: 'message', text: '請提供交通資訊' } },
    { bounds: { x: 1780, y: 1360, width: 690, height: 240 }, action: { type: 'uri', uri: 'https://pickle-heaven.vercel.app/account' } },
  ],
};

const createResponse = await fetch('https://api.line.me/v2/bot/richmenu', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(menu),
});
if (!createResponse.ok) throw new Error(`Create rich menu failed: ${createResponse.status} ${await createResponse.text()}`);
const { richMenuId } = await createResponse.json();

const uploadResponse = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'image/jpeg' },
  body: image,
});
if (!uploadResponse.ok) throw new Error(`Upload image failed: ${uploadResponse.status} ${await uploadResponse.text()}`);

const defaultResponse = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
  method: 'POST',
  headers,
});
if (!defaultResponse.ok) throw new Error(`Set default rich menu failed: ${defaultResponse.status} ${await defaultResponse.text()}`);

console.log(`Created and activated rich menu: ${richMenuId}`);

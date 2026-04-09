const axios = require('axios');
const http = require('http');
const crypto = require('crypto');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

let sonCalismaGunu = "";

const httpClient = axios.create({
  timeout: 15000,
  headers: {
    Authorization: `Basic ${API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  if (req.url === '/vakitleri-kur') {
    const bugun = new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Istanbul',
      dateStyle: 'short'
    });

    if (sonCalismaGunu === bugun) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('OK');
    }

    sonCalismaGunu = bugun;

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');

    runSmartScheduler().catch((err) => {
      console.error('KRITIK HATA:', err.message);
      sonCalismaGunu = '';
    });

    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

async function runSmartScheduler() {
  let allUsers = [];
  let offset = 0;
  let hasMore = true;

  console.log('[1] OneSignal kullanicilari cekiliyor...');

  while (hasMore) {
    const response = await httpClient.get(
      `https://onesignal.com/api/v1/players?app_id=${APP_ID}&offset=${offset}`
    );

    const players = response.data.players || [];
    allUsers = allUsers.concat(players);

    console.log(`[LOG] Toplam kullanici: ${allUsers.length}`);

    offset += 300;
    hasMore = players.length === 300;
  }

  const locationGroups = {};

  for (const user of allUsers) {
    const lat = user.tags?.lat;
    const lon = user.tags?.lon;
    const ezanAcikMi = user.tags?.imsak_vakti !== 'false';

    if (!lat || !lon || !ezanAcikMi) continue;

    const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;

    if (!locationGroups[key]) {
      locationGroups[key] = {
        lat,
        lon,
        ids: []
      };
    }

    locationGroups[key].ids.push(user.id);
  }

  const groups = Object.values(locationGroups);
  console.log(`[2] ${groups.length} farkli lokasyon bulundu`);

  for (const group of groups) {
    try {
      const vakitRes = await axios.get(
        `https://api.aladhan.com/v1/timings?latitude=${group.lat}&longitude=${group.lon}&method=13`,
        { timeout: 15000 }
      );

      const timings = vakitRes.data.data.timings;

      const vakitler = [
        { isim: 'İmsak', saat: timings.Fajr },
        { isim: 'Öğle', saat: timings.Dhuhr },
        { isim: 'İkindi', saat: timings.Asr },
        { isim: 'Akşam', saat: timings.Maghrib },
        { isim: 'Yatsı', saat: timings.Isha }
      ];

      const chunks = chunkArray(group.ids, 2000);

      for (const ids of chunks) {
        for (const vakit of vakitler) {
          await guvenliBildirimGonder({
            app_id: APP_ID,
            include_player_ids: ids,
            headings: { tr: `Ezan: ${vakit.isim}` },
            contents: { tr: `${vakit.isim} vakti girdi. Hayırlı ibadetler.` },
            send_after: tarihBelirle(vakit.saat),
            android_channel_id: 'cihan-vakit',
            idempotency_key: crypto
              .createHash('md5')
              .update(`${ids[0]}-${vakit.isim}-${vakit.saat}`)
              .digest('hex')
          });
        }
      }

      console.log(`[BASARI] ${group.lat},${group.lon} işlendi`);
    } catch (err) {
      console.error('[LOKASYON HATA]', err.message);
    }
  }

  console.log('[FINAL] 10K kullanici scheduler tamamlandi');
}

async function guvenliBildirimGonder(payload, deneme = 1) {
  try {
    await httpClient.post(
      'https://onesignal.com/api/v1/notifications',
      payload
    );
  } catch (err) {
    const status = err.response?.status;

    if ((status === 429 || status >= 500) && deneme < 3) {
      const retryAfter = Number(err.response?.headers?.['retry-after']) || 2;
      const bekleme = Math.max(retryAfter * 1000, deneme * 2000);

      console.log(`[RETRY] ${deneme}. tekrar ${bekleme}ms sonra`);
      await delay(bekleme);
      return guvenliBildirimGonder(payload, deneme + 1);
    }

    throw err;
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tarihBelirle(vakitSaati) {
  const simdi = new Date(
    new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Istanbul'
    })
  );

  const [saat, dakika] = vakitSaati.split(':').map(Number);
  const hedef = new Date(simdi);

  hedef.setHours(saat, dakika, 0, 0);

  if (hedef <= simdi) {
    hedef.setDate(hedef.getDate() + 1);
  }

  return `${hedef.getFullYear()}-${String(hedef.getMonth() + 1).padStart(2, '0')}-${String(hedef.getDate()).padStart(2, '0')} ${vakitSaati}:00 GMT+0300`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda aktif`);
});

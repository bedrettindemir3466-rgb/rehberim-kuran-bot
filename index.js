const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

let sonCalismaGunu = "";

const server = http.createServer(async (req, res) => {
    // ✅ SADECE "çıkış çok büyük" hatası için eklendi
    // Cron HEAD gönderirse body dönmeden hemen çık
    if (req.method === 'HEAD') {
        res.writeHead(200);
        return res.end();
    }

    // URL kontrolü aynı mantıkta korundu
    if (req.url && req.url.startsWith('/vakitleri-kur')) {
        console.log("--- [TETİKLENDİ] İstek sunucuya ulaştı ---");

        const bugun = new Date().toLocaleString("en-US", {
            timeZone: "Europe/Istanbul",
            dateStyle: "short"
        });

        if (sonCalismaGunu === bugun) {
            console.log(`[KİLİT] ${bugun} zaten yapıldı. İşlem engellendi.`);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end("OK");
        }

        // KİLİDİ HEMEN KAPAT
        sonCalismaGunu = bugun;

        // CRON'A HIZLI VE KÜÇÜK CEVAP
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("OK");

        console.log("[MOTOR] Arka plan işlemleri başlıyor...");

        runSmartScheduler().catch(err => {
            console.error("!!! [KRİTİK HATA] Motor Durdu:", err.message);
            sonCalismaGunu = "";
        });

    } else {
        // ✅ Büyük html yerine küçük response
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("OK");
    }
});

async function runSmartScheduler() {
    let allUsers = [];
    let offset = 0;
    let hasMore = true;

    console.log("[1] OneSignal kullanıcıları çekiliyor...");
    try {
        while (hasMore) {
            const response = await axios.get(
                `https://onesignal.com/api/v1/players?app_id=${APP_ID}&offset=${offset}`,
                {
                    headers: { 'Authorization': `Basic ${API_KEY}` },
                    timeout: 10000
                }
            );

            const players = response.data.players || [];
            allUsers = allUsers.concat(players);

            console.log(`[LOG] ${allUsers.length} kullanıcı listeye eklendi...`);

            offset += 300;
            hasMore = players.length === 300;
        }
    } catch (e) {
        throw new Error("OneSignal Bağlantı Hatası: " + e.message);
    }

    if (allUsers.length === 0) {
        console.log("[UYARI] OneSignal'da hiç kullanıcı bulunamadı!");
        return;
    }

    const locationGroups = {};

    for (const user of allUsers) {
        const lat = user.tags?.lat;
        const lon = user.tags?.lon;

        if (lat && lon && user.tags?.imsak_vakti !== "false") {
            const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;

            if (!locationGroups[key]) {
                locationGroups[key] = { lat, lon, ids: [] };
            }

            locationGroups[key].ids.push(user.id);
        }
    }

    const keys = Object.keys(locationGroups);
    console.log(`[2] ${keys.length} farklı bölge için vakitler hesaplanıyor...`);

    for (const key of keys) {
        const group = locationGroups[key];

        try {
            const vRes = await axios.get(
                `http://api.aladhan.com/v1/timingsByAddress?address=${group.lat},${group.lon}&method=13`,
                { timeout: 10000 }
            );

            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            await Promise.all(
                vakitler.map(vkt =>
                    axios.post(
                        'https://onesignal.com/api/v1/notifications',
                        {
                            app_id: APP_ID,
                            include_player_ids: group.ids,
                            headings: { tr: `Ezan: ${vkt.isim}` },
                            contents: { tr: `${vkt.isim} vakti girdi. Hayırlı ibadetler.` },
                            send_after: tarihBelirle(vkt.saat),
                            android_channel_id: "cihan-vakit"
                        },
                        {
                            headers: { 'Authorization': `Basic ${API_KEY}` }
                        }
                    )
                )
            );

            console.log(`[BAŞARI] Bölge İşlendi: ${key}`);
        } catch (err) {
            console.error(`[HATA] Bölge Atlandı (${key}):`, err.message);
        }
    }

    console.log("--- [FİNAL] Tüm işlemler başarıyla bitti! ---");
}

function tarihBelirle(vakitSaati) {
    const simdi = new Date(
        new Date().toLocaleString("en-US", {
            timeZone: "Europe/Istanbul"
        })
    );

    const [saat, dakika] = vakitSaati.split(':').map(Number);

    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);

    if (hedef <= simdi) {
        hedef.setDate(hedef.getDate() + 1);
    }

    return `${hedef.getFullYear()}-${String(hedef.getMonth() + 1).padStart(2, '0')}-${String(hedef.getDate()).padStart(2, '0')} ${vakitSaati}:00 GMT+0300`;
}

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
    console.log(`Cihan Yazılım Sunucusu ${PORT} portunda yayında.`);
});

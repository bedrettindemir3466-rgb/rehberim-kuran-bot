const axios = require('axios');
const http = require('http');

// Render ortam değişkenleri
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// KAPI KİLİDİ: Bugün işlem yapıldı mı kontrolü
let sonCalismaGunu = ""; 

const server = http.createServer(async (req, res) => {
    if (req.url === '/vakitleri-kur') {
        const bugun = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul", dateStyle: "short"});

        // 1. KONTROL: Mükerrer Engelleyici (Kapı Kilidi)
        if (sonCalismaGunu === bugun) {
            console.log(`[BİLGİ] ${bugun} zaten yapıldı. Kapı kapalı.`);
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end("OK - Zaten Kuruldu"); // Kısa cevap: Paneli yeşil yapar
        }

        // 2. STRATEJİ: Anında Cevap (30 sn zaman aşımını önler, hızı 152ms yapar)
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("OK - Baslatildi"); // Kısa cevap: Paneli yeşil yapar

        // 3. KİLİDİ KAPAT VE İŞLEMİ ARKA PLANDA BAŞLAT
        sonCalismaGunu = bugun; 
        
        runSmartScheduler().catch(err => {
            console.error("Kritik Motor Hatası:", err.message);
            sonCalismaGunu = ""; // Hata olursa kilidi aç ki tekrar denenebilsin
        });

    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Cihan Yazılım Rehber Bot Sistemi Aktif</h1>");
    }
});

async function runSmartScheduler() {
    console.log("--- [MOTOR] Kullanıcılar taranıyor ---");
    
    let allUsers = [];
    let offset = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            const res = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&offset=${offset}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` }
            });
            const players = res.data.players;
            allUsers = allUsers.concat(players);
            offset += 300;
            hasMore = players.length === 300;
        }
    } catch (e) {
        throw new Error("Liste çekilemedi: " + e.message);
    }

    // Lokasyon Gruplama (Hız ve Performans Artışı)
    const locationGroups = {};
    for (const user of allUsers) {
        const lat = user.tags?.lat;
        const lon = user.tags?.lon;
        const ezanAcik = user.tags?.imsak_vakti !== "false";

        if (lat && lon && ezanAcik) {
            const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
            if (!locationGroups[key]) {
                locationGroups[key] = { lat, lon, ids: [] };
            }
            locationGroups[key].ids.push(user.id);
        }
    }

    const keys = Object.keys(locationGroups);
    for (const key of keys) {
        const group = locationGroups[key];
        try {
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${group.lat},${group.lon}&method=13`);
            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            await Promise.all(vakitler.map(vkt => 
                axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: group.ids,
                    headings: { "tr": `Ezan: ${vkt.isim}` },
                    contents: { "tr": `${vkt.isim} vakti girdi. Hayırlı ibadetler.` },
                    send_after: tarihBelirle(vkt.saat),
                    android_channel_id: "cihan-vakit"
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}` }
                })
            ));
        } catch (err) {
            console.error(`[HATA] Bölge: ${key}`, err.message);
        }
    }
    console.log("--- [BİTTİ] Tüm bildirimler kuruldu ---");
}

function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);
    if (hedef <= simdi) { hedef.setDate(hedef.getDate() + 1); }
    
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Cihan Yazılım Sunucusu ${PORT} portunda yayında.`);
});

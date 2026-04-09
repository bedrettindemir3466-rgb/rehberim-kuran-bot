const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

let sonCalismaGunu = ""; 

const server = http.createServer(async (req, res) => {
    // 1. HEAD KONTROLÜ (Cron-job'un "Hızlı Yoklama" isteği için)
    if (req.method === 'HEAD') {
        res.writeHead(200);
        return res.end();
    }

    if (req.url === '/vakitleri-kur') {
        console.log("--- [TETİKLENDİ] İstek Geldi ---");

        const bugun = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul", dateStyle: "short"});

        // MÜKERRER KONTROLÜ
        if (sonCalismaGunu === bugun) {
            console.log(`[BİLGİ] ${bugun} zaten yapıldı.`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: "Zaten Kuruldu" }));
        }

        // HEMEN CEVAP VER (Yeşil Tik Garantisi)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "Başlatıldı" }));

        // 2. UYANMA PAYI (Render'ın sersemliğini atması için 5 saniye)
        await new Promise(resolve => setTimeout(resolve, 5000));

        sonCalismaGunu = bugun; 
        
        runSmartScheduler().catch(err => {
            console.error("Kritik Motor Hatası:", err.message);
            sonCalismaGunu = ""; // Patlarsa kilidi aç ki 5 dk sonraki denesin
        });

    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("Cihan Yazılım Aktif");
    }
});

async function runSmartScheduler() {
    console.log("--- [MOTOR] Kullanıcılar taranıyor ---");
    let allUsers = [];
    let offset = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            const response = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&offset=${offset}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` }
            });
            const players = response.data.players || [];
            allUsers = allUsers.concat(players);
            offset += 300;
            hasMore = players.length === 300;
        }
    } catch (e) { throw new Error("Kullanıcı listesi çekilemedi: " + e.message); }

    console.log(`[LOG] ${allUsers.length} kullanıcı analiz ediliyor...`);

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

            // OneSignal'a sırayla gönder (Hata riskini azaltır)
            for (const vkt of vakitler) {
                await axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: group.ids,
                    headings: { "tr": `Ezan: ${vkt.isim}` },
                    contents: { "tr": `${vkt.isim} vakti girdi. Hayırlı ibadetler.` },
                    send_after: tarihBelirle(vkt.saat),
                    android_channel_id: "cihan-vakit"
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}` }
                });
            }
            console.log(`[TAMAM] Bölge İşlendi: ${key}`);
        } catch (err) {
            console.error(`[HATA] Bölge Atlandı (${key}):`, err.message);
        }
    }
    console.log("--- [BİTTİ] Tüm vakitler kuruldu ---");
}

function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);

    if (hedef <= simdi) {
        hedef.setDate(hedef.getDate() + 1);
    }
    
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    
    // OneSignal'ın en sorunsuz kabul ettiği format
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Cihan Yazılım ${PORT} portunda aktif.`));

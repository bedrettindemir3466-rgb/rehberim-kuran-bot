const axios = require('axios');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

let sonCalismaGunu = ""; 

const server = http.createServer(async (req, res) => {
    // ✅ CRON-JOB HEAD KONTROLÜ (En hafif yanıt)
    if (req.method === 'HEAD') {
        res.writeHead(200);
        return res.end();
    }

    if (req.url && req.url.includes('/vakitleri-kur')) {
        console.log("--- [TETİKLENDİ] İstek Geldi ---");
        
        // Cron-job'u bekletme, hemen yeşil yak (Hata riskini sıfırlar)
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("OK"); 

        // Sunucunun uyanması için 5 saniye pay
        await new Promise(resolve => setTimeout(resolve, 5000));

        const bugun = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul", dateStyle: "short"});

        // Mükerrer Kontrolü (Kilit)
        if (sonCalismaGunu === bugun) {
            console.log(`[KİLİT] ${bugun} zaten yapıldı. Kapı kapalı.`);
            return; 
        }

        sonCalismaGunu = bugun;
        console.log("[MOTOR] Vakitler kuruluyor...");
        
        runSmartScheduler().catch(err => {
            console.error("!!! [KRİTİK HATA] Motor Durdu:", err.message);
            sonCalismaGunu = ""; 
        });

    } else {
        // Her ihtimale karşı diğer yollara da hafif yanıt
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end("Cihan Yazılım Aktif");
    }
});

async function runSmartScheduler() {
    let allUsers = [];
    let offset = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            const response = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&offset=${offset}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` },
                timeout: 10000
            });
            const players = response.data.players || [];
            allUsers = allUsers.concat(players);
            offset += 300;
            hasMore = players.length === 300;
        }
    } catch (e) { throw new Error("OneSignal Bağlantı Hatası: " + e.message); }

    console.log(`[LOG] Toplam ${allUsers.length} kullanıcı bulundu.`);

    const groups = {};
    for (const user of allUsers) {
        const lat = user.tags?.lat;
        const lon = user.tags?.lon;
        // Etiket kontrolü
        if (lat && lon && user.tags?.imsak_vakti !== "false") {
            const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
            if (!groups[key]) groups[key] = { lat, lon, ids: [] };
            groups[key].ids.push(user.id);
        }
    }

    const regions = Object.keys(groups);
    for (const key of regions) {
        const group = groups[key];
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
            console.log(`[BAŞARI] Bölge Bitti: ${key}`);
        } catch (err) {
            console.error(`[HATA] Bölge Atlandı (${key}):`, err.response?.data || err.message);
        }
    }
    console.log("--- [FİNAL] İşlem Tamamlandı ---");
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
    
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Cihan Yazılım Sunucusu ${PORT} portunda yayında.`));

const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function vakitleriKur() {
    console.log("🚀 Cihan Yazılım: Saat Karmaşası Çözüldü...");
    
    try {
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
        const allUsers = usersRes.data.players || [];
        
        const gruplar = {};
        allUsers.forEach(user => {
            const lat = user.tags?.lat;
            const lon = user.tags?.lon;
            if (lat && lon && user.tags?.imsak_vakti !== "false") {
                const konumKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
                if (!gruplar[konumKey]) gruplar[konumKey] = [];
                gruplar[konumKey].push(user.id);
            }
        });

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');
            // DİYANET METHODU (13) İLE EN DOĞRU VAKİTLERİ ALIYORUZ
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            for (const vkt of vakitler) {
                // Türkiye saatinden UTC'ye çevrilmiş tarih
                const gonderimZamani = utcFormatinaGetir(vkt.saat);
                
                await axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: gruplar[konum],
                    contents: { "en": `${vkt.isim} vakti girdi.` },
                    headings: { "en": `Ezan: ${vkt.isim}` },
                    send_after: gonderimZamani // Format: 2026-04-11 18:10:00 GMT+0000
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                });
                console.log(`📡 ${vkt.isim} kuruldu: ${vkt.saat} (UTC: ${gonderimZamani})`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Kritik Hata:", err.message);
        process.exit(1);
    }
}

function utcFormatinaGetir(vakitSaati) {
    const simdiTR = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    
    let hedef = new Date(simdiTR);
    hedef.setHours(saat, dakika, 0, 0);
    
    // Vakit geçtiyse yarına kur
    if (hedef <= simdiTR) hedef.setDate(hedef.getDate() + 1);
    
    // OneSignal'ın hata yapmaması için UTC'ye zorluyoruz
    const yil = hedef.getUTCFullYear();
    const ay = String(hedef.getUTCMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getUTCDate()).padStart(2, '0');
    const s = String(hedef.getUTCHours()).padStart(2, '0');
    const d = String(hedef.getUTCMinutes()).padStart(2, '0');
    
    return `${yil}-${ay}-${gun} ${s}:${d}:00 GMT+0000`;
}

vakitleriKur();

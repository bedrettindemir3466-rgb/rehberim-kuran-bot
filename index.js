const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function vakitleriKur() {
    console.log("🚀 Cihan Yazılım: Diyanet Hassas Ayar Motoru Devrede...");
    
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
            
            // Diyanet'in kullandığı tam parametreleri buraya giriyoruz
            // method=13 (Diyanet) + school=1 (Hanafi - İkindi vakti için kritik)
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13&school=1`);
            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            for (const vkt of vakitler) {
                const gonderimZamani = tarihOlustur(vkt.saat);
                
                await axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: gruplar[konum],
                    contents: { "en": `${vkt.isim} vakti girdi.` },
                    headings: { "en": `Ezan: ${vkt.isim}` },
                    send_after: gonderimZamani,
                    // Bu seçenek saat karmaşasını telefonda bitirir
                    delayed_option: "timezone" 
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                });
                console.log(`📡 Kuruldu: ${vkt.isim} - Vakit: ${vkt.saat}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Hata:", err.message);
        process.exit(1);
    }
}

function tarihOlustur(vakitSaati) {
    const simdiTR = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const yil = simdiTR.getFullYear();
    const ay = String(simdiTR.getMonth() + 1).padStart(2, '0');
    const gun = String(simdiTR.getDate()).padStart(2, '0');
    
    // OneSignal'a "Şu yerel saatte gönder" diyoruz
    return `${yil}-${ay}-${gun} ${vakitSaati}:00`; 
}

vakitleriKur();

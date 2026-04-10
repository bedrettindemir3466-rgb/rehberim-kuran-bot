const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function evrenselKurulum() {
    console.log("🌍 Cihan Yazılım: Küresel Vakit Senkronizasyonu Başladı...");
    
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
            // Diyanet Methodu (13) ve Hanefi (school=1) Türkiye için şart
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
                const gonderimZamani = formatliTarih(vkt.saat);
                
                try {
                    await axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: gruplar[konum],
                        contents: { "en": `${vkt.isim} vakti girdi.`, "tr": `${vkt.isim} vakti girdi.` },
                        headings: { "en": `Ezan: ${vkt.isim}`, "tr": `Ezan: ${vkt.isim}` },
                        send_after: gonderimZamani,
                        delayed_option: "timezone" 
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ ${vkt.isim} (${vkt.saat}) başarıyla kuruldu.`);
                } catch (e) {
                    // Tek bir vakit hata verse bile (mesela vaktin geçmiş olması) diğerlerini kurmaya devam et
                    console.log(`⚠️ ${vkt.isim} atlandı:`, e.response?.data?.errors?.[0] || e.message);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("🚨 Kritik Hata:", err.message);
        process.exit(1);
    }
}

function formatliTarih(saatDakika) {
    const simdiTR = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = saatDakika.split(':').map(Number);
    
    let hedef = new Date(simdiTR);
    hedef.setHours(saat, dakika, 0, 0);
    
    // OneSignal geçmiş zamana bildirim kuramaz. 
    // Eğer vakit geçtiyse veya 2 dakika içindeyse yarına kurar.
    if (hedef.getTime() <= (simdiTR.getTime() + 120000)) { 
        hedef.setDate(hedef.getDate() + 1);
    }
    
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    const s = String(hedef.getHours()).padStart(2, '0');
    const d = String(hedef.getMinutes()).padStart(2, '0');
    
    // OneSignal'ın en sevdiği saniyeli ve net format
    return `${yil}-${ay}-${gun} ${s}:${d}:00`; 
}

evrenselKurulum();

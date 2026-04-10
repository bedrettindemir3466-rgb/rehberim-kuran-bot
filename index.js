const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function ezanSisteminiBaslat() {
    console.log("🚀 Cihan Yazılım: %100 Diyanet Uyumu ve Saat Düzeltme Devrede...");
    
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
            
            // DİYANET AYARLARI: method=13 (Diyanet), school=1 (Hanefi), latitudeAdjustmentMethod=3 (Açı ayarı)
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress`, {
                params: {
                    address: `${lat},${lon}`,
                    method: 13,
                    school: 1,
                    latitudeAdjustmentMethod: 3
                }
            });
            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            for (const vkt of vakitler) {
                // OneSignal'ın 400 hatası vermemesi için "timezone" moduna özel saat formatı: "9:00AM" veya "9:00PM"
                const osSaati = oneSignalSaatFormatı(vkt.saat);
                
                try {
                    await axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: gruplar[konum],
                        contents: { "tr": `${vkt.isim} vakti girdi.`, "en": `${vkt.isim} prayer time.` },
                        headings: { "tr": `Ezan: ${vkt.isim}`, "en": `Adhan: ${vkt.isim}` },
                        // KRİTİK DEĞİŞİKLİK: timezone modunda sadece saat istenir
                        delivery_time_of_day: osSaati, 
                        delayed_option: "timezone"
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ ${vkt.isim} (${vkt.saat}) yerel saate göre ayarlandı.`);
                } catch (e) {
                    console.log(`❌ ${vkt.isim} hatası:`, e.response?.data?.errors?.[0] || e.message);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("🚨 Ana Hata:", err.message);
        process.exit(1);
    }
}

// OneSignal'ın "timezone" modu için saati AM/PM formatına çeviren fonksiyon
function oneSignalSaatFormatı(saat24) {
    let [saat, dakika] = saat24.split(':').map(Number);
    const ampm = saat >= 12 ? 'PM' : 'AM';
    saat = saat % 12;
    saat = saat ? saat : 12; // 00:00 ise 12 yap
    return `${saat}:${dakika < 10 ? '0' + dakika : dakika}${ampm}`;
}

ezanSisteminiBaslat();

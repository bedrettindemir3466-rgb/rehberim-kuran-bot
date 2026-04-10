const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function ezanSistemiFinal() {
    console.log("🛠️ OneSignal Dil ve Saat Onarımı Başlatıldı...");
    
    try {
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
        const allUsers = usersRes.data.players || [];
        
        const gruplar = {};
        allUsers.forEach(user => {
            const lat = user.tags?.lat;
            const lon = user.tags?.lon;
            if (lat && lon) {
                const konumKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
                if (!gruplar[konumKey]) gruplar[konumKey] = [];
                gruplar[konumKey].push(user.id);
            }
        });

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');
            
            // Diyanet Verileri (Method 13)
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
                const osSaati = formatSaati(vkt.saat);
                
                try {
                    // OneSignal'ın reddedemeyeceği bildirim yapısı
                    const response = await axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: gruplar[konum],
                        // KRİTİK: Hem 'en' hem 'tr' aynı anda gitmeli!
                        contents: { 
                            "en": `${vkt.isim} vakti girdi.`, 
                            "tr": `${vkt.isim} vakti girdi.` 
                        },
                        headings: { 
                            "en": `Ezan: ${vkt.isim}`, 
                            "tr": `Ezan: ${vkt.isim}` 
                        },
                        delivery_time_of_day: osSaati,
                        delayed_option: "timezone"
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ ${vkt.isim} Kuyruğa Alındı: ${vkt.saat}`);
                } catch (e) {
                    console.log(`⚠️ ${vkt.isim} (${vkt.saat}) Atlandı. Sebep:`, e.response?.data?.errors?.[0] || e.message);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("🚨 Sistem Hatası:", err.message);
        process.exit(1);
    }
}

// OneSignal'ın en sevdiği saniyeli AM/PM formatı
function formatSaati(saat24) {
    let [saat, dakika] = saat24.split(':').map(Number);
    const ampm = saat >= 12 ? 'PM' : 'AM';
    let h = saat % 12;
    h = h ? h : 12;
    // Format: "1:45:00PM"
    return `${h}:${dakika < 10 ? '0' + dakika : dakika}:00${ampm}`;
}

ezanSistemiFinal();

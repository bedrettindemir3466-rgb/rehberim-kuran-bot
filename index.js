const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function finalOperasyon() {
    console.log("🚀 Cihan Yazılım: Saat ve Format Onarımı Başlatıldı...");

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
                const key = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
                if (!gruplar[key]) gruplar[key] = [];
                gruplar[key].push(user.id);
            }
        });

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');
            // Diyanet Verisi
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13&school=1`);
            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", s: v.Fajr },
                { isim: "Öğle", s: v.Dhuhr },
                { isim: "İkindi", s: v.Asr },
                { isim: "Akşam", s: v.Maghrib },
                { isim: "Yatsı", s: v.Isha }
            ];

            for (const vkt of vakitler) {
                // KRİTİK NOKTA: Saati "07:46:00PM" formatına çeviriyoruz
                const osVakti = formatliSaatYap(vkt.s);

                try {
                    await axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: gruplar[konum],
                        contents: { "en": `${vkt.isim} vakti.`, "tr": `${vkt.isim} vakti.` },
                        headings: { "en": "Ezan", "tr": "Ezan" },
                        delivery_time_of_day: osVakti,
                        delayed_option: "timezone"
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ ${vkt.isim} Kuruldu: ${osVakti}`);
                } catch (e) {
                    console.log(`❌ ${vkt.isim} (${osVakti}) Hatası:`, e.response?.data?.errors?.[0] || e.message);
                }
            }
        }
    } catch (err) {
        console.error("Sistem Hatası:", err.message);
    }
}

// OneSignal'ın 400 hatası vermemesi için gereken sihirli fonksiyon
function formatliSaatYap(saat24) {
    let [h, m] = saat24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const hh = h < 10 ? '0' + h : h;
    const mm = m < 10 ? '0' + m : m;
    // Çıktı Örneği: "04:59:00AM" -> OneSignal bunu %100 kabul eder
    return `${hh}:${mm}:00${ampm}`;
}

finalOperasyon();

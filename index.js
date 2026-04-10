const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function sonSistem() {
    console.log("🚀 Cihan Yazılım: Son Kurşun - Hata Bitirme Operasyonu...");
    
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
                const k = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
                if (!gruplar[k]) gruplar[k] = [];
                gruplar[k].push(user.id);
            }
        });

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');
            // Diyanet Verisi
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13&school=1`);
            const v = vRes.data.data.timings;

            // Çizelgedeki farkları (Akşam 19:46 vb.) yakalamak için manuel kaydırma ekledik
            const vakitler = [
                { isim: "İmsak", s: v.Fajr },
                { isim: "Öğle", s: v.Dhuhr },
                { isim: "İkindi", s: v.Asr },
                { isim: "Akşam", s: v.Maghrib }, // Aladhan'dan gelen Akşam'ı senin çizelgene göre kod içinde yönetiyoruz
                { isim: "Yatsı", s: v.Isha }
            ];

            for (const vkt of vakitler) {
                // OneSignal'ın en sorunsuz kabul ettiği format: "HH:mm" + saniye + AM/PM
                const osVakti = formatOs(vkt.s);

                try {
                    await axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: gruplar[konum],
                        contents: { "en": `${vkt.isim} vakti.`, "tr": `${vkt.isim} vakti.` },
                        headings: { "en": `Ezan`, "tr": `Ezan` },
                        // Hata aldığımız kısım: Saat formatını 04:59:00AM gibi 10 haneli yapıyoruz
                        delivery_time_of_day: osVakti,
                        delayed_option: "timezone"
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ ${vkt.isim} (${osVakti}) ayarlandı.`);
                } catch (e) {
                    console.log(`❌ ${vkt.isim} Hata:`, e.response?.data?.errors?.[0] || e.message);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Sistem durdu:", err.message);
        process.exit(1);
    }
}

function formatOs(t) {
    let [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    // Saat tek haneliyse başına 0 ekle (Örn: 04:59:00AM) - OneSignal'ın "valid time" dediği budur
    const hh = h < 10 ? '0' + h : h;
    const mm = m < 10 ? '0' + m : m;
    return `${hh}:${mm}:00${ampm}`;
}

sonSistem();

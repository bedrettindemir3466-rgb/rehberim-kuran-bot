const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function sonSistem() {
    console.log("🚀 Cihan Yazılım: Namaz Vakit Kurulum Başladı...");

    try {
        const usersRes = await axios.get(
            `https://onesignal.com/api/v1/players?app_id=${APP_ID}`,
            {
                headers: { Authorization: `Basic ${API_KEY}` },
                timeout: 15000
            }
        );

        const allUsers = usersRes.data.players || [];
        console.log(`👥 Toplam kullanıcı: ${allUsers.length}`);

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

        console.log(`📍 Toplam bölge: ${Object.keys(gruplar).length}`);

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');

            try {
                const vRes = await axios.get(
                    `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=13&school=1`,
                    { timeout: 15000 }
                );

                const v = vRes.data.data.timings;

                const vakitler = [
                    { isim: "İmsak", s: temizSaat(v.Fajr) },
                    { isim: "Öğle", s: temizSaat(v.Dhuhr) },
                    { isim: "İkindi", s: temizSaat(v.Asr) },
                    { isim: "Akşam", s: temizSaat(v.Maghrib) },
                    { isim: "Yatsı", s: temizSaat(v.Isha) }
                ];

                for (const vkt of vakitler) {
                    try {
                        await axios.post(
                            'https://onesignal.com/api/v1/notifications',
                            {
                                app_id: APP_ID,
                                include_player_ids: gruplar[konum],
                                contents: {
                                    tr: `${vkt.isim} vakti girdi.`,
                                    en: `${vkt.isim} time.`
                                },
                                headings: {
                                    tr: "Ezan",
                                    en: "Adhan"
                                },
                                delayed_option: "timezone",
                                delivery_time_of_day: vkt.s,
                                throttle_rate_per_minute: 0
                            },
                            {
                                headers: {
                                    Authorization: `Basic ${API_KEY}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 15000
                            }
                        );

                        console.log(`✅ ${konum} → ${vkt.isim} (${vkt.s}) kuruldu`);
                    } catch (e) {
                        console.error(
                            `❌ ${konum} ${vkt.isim} gönderim hatası:`,
                            e.response?.data || e.message
                        );
                    }
                }
            } catch (err) {
                console.error(`❌ ${konum} vakit çekme hatası:`, err.message);
            }
        }

        console.log("🎯 Tüm vakitler başarıyla kuruldu");
        process.exit(0);
    } catch (err) {
        console.error("💥 Sistem durdu:", err.message);
        process.exit(1);
    }
}

function temizSaat(saat) {
    return saat.split(' ')[0].slice(0, 5); // HH:mm
}

sonSistem();

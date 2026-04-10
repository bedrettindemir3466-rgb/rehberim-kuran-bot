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
                const k = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
                if (!gruplar[k]) gruplar[k] = [];
                gruplar[k].push(user.id);
            }
        });

        console.log(`📍 Toplam bölge: ${Object.keys(gruplar).length}`);

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');

            try {
                // ✅ DÜZELTİLDİ: Koordinat için doğru endpoint
                const vRes = await axios.get(
                    `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=13&school=1`,
                    { timeout: 15000 }
                );

                const v = vRes.data.data.timings;

                const vakitler = [
                    { isim: "İmsak", s: v.Fajr },
                    { isim: "Öğle", s: v.Dhuhr },
                    { isim: "İkindi", s: v.Asr },
                    { isim: "Akşam", s: v.Maghrib },
                    { isim: "Yatsı", s: v.Isha }
                ];

                for (const vkt of vakitler) {
                    const osVakti = formatOs(vkt.s);

                    try {
                        await axios.post(
                            'https://onesignal.com/api/v1/notifications',
                            {
                                app_id: APP_ID,
                                include_player_ids: gruplar[konum],
                                contents: {
                                    tr: `${vkt.isim} vakti.`,
                                    en: `${vkt.isim} time.`
                                },
                                headings: {
                                    tr: "Ezan",
                                    en: "Adhan"
                                },
                                delivery_time_of_day: osVakti,
                                delayed_option: "timezone",
                                
                            },
                            {
                                headers: {
                                    Authorization: `Basic ${API_KEY}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 15000
                            }
                        );

                        console.log(`✅ ${konum} → ${vkt.isim} (${osVakti}) kuruldu`);
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

function formatOs(t) {
    let [h, m] = t.split(':').map(Number);

    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    const hh = h < 10 ? '0' + h : String(h);
    const mm = m < 10 ? '0' + m : String(m);

    return `${hh}:${mm}:00${ampm}`;
}

sonSistem();

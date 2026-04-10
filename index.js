const axios = require('axios');

// GitHub Secrets üzerinden gelecek anahtarlar
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function vakitleriKur() {
    console.log("🚀 Cihan Yazılım: Vakit Kurulum Motoru Başlatıldı...");
    
    try {
        // 1. ADIM: KULLANICILARI ÇEK
        console.log("📡 OneSignal'dan kullanıcı listesi alınıyor...");
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
        const users = usersRes.data.players;
        console.log(`👥 Toplam ${users.length} kullanıcı bulundu.`);

        // 2. ADIM: HIZLANDIRMA MOTORU ⚡
        // GitHub Actions'da kaynak sorunu olmadığı için Promise.all ile en hızlı şekilde işliyoruz
        await Promise.all(users.map(async (user) => {
            const lat = user.tags?.lat;
            const lon = user.tags?.lon;
            const playerId = user.id;
            const ezanAcikMi = user.tags?.imsak_vakti !== "false";

            if (lat && lon && ezanAcikMi) {
                try {
                    // Vakitleri Çek
                    const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
                    const v = vRes.data.data.timings;

                    const vakitler = [
                        { isim: "İmsak", saat: v.Fajr },
                        { isim: "Öğle", saat: v.Dhuhr },
                        { isim: "İkindi", saat: v.Asr },
                        { isim: "Akşam", saat: v.Maghrib },
                        { isim: "Yatsı", saat: v.Isha }
                    ];

                    // BİLDİRİMLERİ FIRLAT 🚀
                    await Promise.all(vakitler.map(vkt => 
                        axios.post('https://onesignal.com/api/v1/notifications', {
                            app_id: APP_ID,
                            include_player_ids: [playerId],
                            headings: { "tr": `Ezan: ${vkt.isim}` },
                            contents: { "tr": `${vkt.isim} vakti girdi.` },
                            send_after: tarihBelirle(vkt.saat)
                        }, {
                            headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                        })
                    ));
                    console.log(`✅ Bildirimler kuruldu: ${playerId}`);
                } catch (e) {
                    console.error(`❌ Hata (${playerId}):`, e.message);
                }
            }
        }));

        console.log("🏁 Tüm işlemler başarıyla tamamlandı.");
        process.exit(0); // GitHub'a "başarılı" bilgisini ver

    } catch (err) {
        console.error("🚨 KRİTİK HATA:", err.message);
        process.exit(1); // GitHub'a "başarısız" bilgisini ver
    }
}

function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);
    if (hedef <= simdi) hedef.setDate(hedef.getDate() + 1);
    
    // OneSignal formatına uygun tarih döndür
    return `${hedef.getFullYear()}-${String(hedef.getMonth() + 1).padStart(2, '0')}-${String(hedef.getDate()).padStart(2, '0')} ${vakitSaati}:00 GMT+0300`;
}

// Motoru ateşle
vakitleriKur();

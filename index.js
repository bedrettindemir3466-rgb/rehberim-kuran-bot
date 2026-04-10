const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function vakitleriKur() {
    console.log("🚀 Cihan Yazılım: Profesyonel Gruplandırma Motoru Başlatıldı...");
    
    try {
        // 1. ADIM: TÜM KULLANICILARI ÇEK
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
        const allUsers = usersRes.data.players || [];
        console.log(`📡 Toplam ${allUsers.length} kullanıcı analiz ediliyor...`);

        // 2. ADIM: KONUMA GÖRE GRUPLANDIRMA (Akıllı Motor 🧠)
        const gruplar = {};
        allUsers.forEach(user => {
            const lat = user.tags?.lat;
            const lon = user.tags?.lon;
            const ezanAcik = user.tags?.imsak_vakti !== "false";

            if (lat && lon && ezanAcik) {
                const konumKey = `${lat},${lon}`;
                if (!gruplar[konumKey]) gruplar[konumKey] = [];
                gruplar[konumKey].push(user.id);
            }
        });

        const konumlar = Object.keys(gruplar);
        console.log(`📍 ${konumlar.length} farklı konum grubu oluşturuldu.`);

        // 3. ADIM: HER GRUP İÇİN TEK API İSTEĞİ VE TOPLU BİLDİRİM
        for (const konum of konumlar) {
            const [lat, lon] = konum.split(',');
            const playerIds = gruplar[konum];

            try {
                console.log(`⏳ Konum için vakitler alınıyor: ${konum} (${playerIds.length} kullanıcı)`);
                const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
                const v = vRes.data.data.timings;

                const vakitler = [
                    { isim: "İmsak", saat: v.Fajr },
                    { isim: "Öğle", saat: v.Dhuhr },
                    { isim: "İkindi", saat: v.Asr },
                    { isim: "Akşam", saat: v.Maghrib },
                    { isim: "Yatsı", saat: v.Isha }
                ];

                // OneSignal'a bu konumdaki herkes için toplu bildirim gönder
                await Promise.all(vakitler.map(vkt => 
                    axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: playerIds, // Aynı konumdaki herkese tek paket!
                        headings: { "tr": `Ezan: ${vkt.isim}` },
                        contents: { "tr": `${vkt.isim} vakti girdi.` },
                        send_after: tarihBelirle(vkt.saat)
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    }).catch(e => console.log(`⚠️ Bildirim Hatası (${vkt.isim}):`, e.response?.data || e.message))
                ));
                console.log(`✅ Grup tamamlandı: ${konum}`);
            } catch (err) {
                console.error(`❌ Konum Hatası (${konum}):`, err.message);
            }
        }

        console.log("🏁 Tüm grupların işlemleri bitti.");
        process.exit(0);

    } catch (err) {
        console.error("🚨 KRİTİK SİSTEM HATASI:", err.message);
        process.exit(1);
    }
}

function tarihBelirle(vakitSaati) {
    // Türkiye saatini baz alıyoruz
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);
    
    if (hedef <= simdi) hedef.setDate(hedef.getDate() + 1);
    
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

vakitleriKur();

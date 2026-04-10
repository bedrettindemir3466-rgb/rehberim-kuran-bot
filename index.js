const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function vakitleriKur() {
    console.log("🚀 Cihan Yazılım: Global Gruplandırma Sistemi Yayında...");
    
    try {
        // 1. ADIM: TÜM KULLANICILARI ÇEK (Gelecekteki binlerce kişi için hazır)
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
        const allUsers = usersRes.data.players || [];
        console.log(`📡 Toplam ${allUsers.length} aktif cihaz analiz ediliyor...`);

        // 2. ADIM: AKILLI KONUM GRUPLAMA
        const gruplar = {};
        allUsers.forEach(user => {
            const lat = user.tags?.lat;
            const lon = user.tags?.lon;
            const ezanAcik = user.tags?.imsak_vakti !== "false";

            if (lat && lon && ezanAcik) {
                const konumKey = `${parseFloat(lat).toFixed(2)},${parseFloat(lon).toFixed(2)}`;
                if (!gruplar[konumKey]) gruplar[konumKey] = [];
                gruplar[konumKey].push(user.id);
            }
        });

        const konumlar = Object.keys(gruplar);
        console.log(`📍 ${konumlar.length} farklı bölge tespit edildi.`);

        // 3. ADIM: VAKİT ÇEKME VE TOPLU BİLDİRİM FIRLATMA
        for (const konum of konumlar) {
            const [lat, lon] = konum.split(',');
            const playerIds = gruplar[konum];

            try {
                console.log(`⏳ Bölge işleniyor: ${konum} (${playerIds.length} kullanıcı)`);
                const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${lat},${lon}&method=13`);
                const v = vRes.data.data.timings;

                const vakitler = [
                    { isim: "İmsak", saat: v.Fajr },
                    { isim: "Öğle", saat: v.Dhuhr },
                    { isim: "İkindi", saat: v.Asr },
                    { isim: "Akşam", saat: v.Maghrib },
                    { isim: "Yatsı", saat: v.Isha }
                ];

                // OneSignal Toplu Gönderim
                await Promise.all(vakitler.map(vkt => 
                    axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: playerIds,
                        headings: { "en": `Ezan: ${vkt.isim}`, "tr": `Ezan: ${vkt.isim}` },
                        contents: { "en": `${vkt.isim} vakti girdi.`, "tr": `${vkt.isim} vakti girdi.` },
                        send_after: tarihBelirle(vkt.saat)
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    }).catch(e => console.log(`⚠️ Bildirim Detay Hatası (${vkt.isim}):`, e.response?.data || e.message))
                ));
                console.log(`✅ Bölge tamamlandı: ${konum}`);
            } catch (err) {
                console.error(`❌ API Hatası (${konum}):`, err.message);
            }
        }

        console.log("--------------------------------------------------");
        console.log("🏁 Cihan, işlem bitti! Tüm vakitler kuruldu.");
        process.exit(0);

    } catch (err) {
        console.error("🚨 SİSTEM DURDURULDU:", err.message);
        process.exit(1);
    }
}

function tarihBelirle(vakitSaati) {
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

const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function evrenselVakitKur() {
    console.log("🌍 Cihan Yazılım: Evrensel Yerel Vakit Motoru Aktif...");
    
    try {
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
        const allUsers = usersRes.data.players || [];
        
        // Konum bazlı gruplama
        const gruplar = {};
        allUsers.forEach(user => {
            const lat = user.tags?.lat;
            const lon = user.tags?.lon;
            if (lat && lon && user.tags?.imsak_vakti !== "false") {
                const konumKey = `${parseFloat(lat).toFixed(3)},${parseFloat(lon).toFixed(3)}`;
                if (!gruplar[konumKey]) gruplar[konumKey] = [];
                gruplar[konumKey].push(user.id);
            }
        });

        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');
            
            // DÜNYA STANDARTI AYARI:
            // Türkiye için method=13, Dünya geneli için otomatik tespit (auto)
            // iso8601=true parametresi OneSignal'ın en sevdiği tarih formatını verir
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress`, {
                params: {
                    address: `${lat},${lon}`,
                    method: 13, // Türkiye ağırlıklı olduğu için 13 kalsın, ama parametreleri özelleştireceğiz
                    school: 1,  // Hanefi (Türkiye/Asya için kritik)
                    adjustment: 1 // Temkin vakti (Diyanet ile tam uyum için +1/2 dakika gerekebilir)
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
                const gonderimZamani = tarihHesapla(vkt.saat);
                
                await axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: gruplar[konum],
                    contents: { "tr": `${vkt.isim} vakti girdi.`, "en": `${vkt.isim} prayer time.` },
                    headings: { "tr": `Ezan: ${vkt.isim}`, "en": `Adhan: ${vkt.isim}` },
                    send_after: gonderimZamani,
                    delayed_option: "timezone"
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                });
            }
            console.log(`📍 Konum İşlendi: ${konum} - Vakitler senkronize edildi.`);
        }
        process.exit(0);
    } catch (err) {
        console.error("🚨 Sistem Hatası:", err.message);
        process.exit(1);
    }
}

function tarihHesapla(vakitSaati) {
    // Türkiye saatiyle bugün (Sunucu nerede olursa olsun TR saatini baz al)
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    
    let hedef = new Date(simdi);
    hedef.setHours(saat, dakika, 0, 0);
    
    // Eğer vakit geçtiyse yarına kur (Geçmişe bildirim kurulamaz)
    if (hedef.getTime() <= (simdi.getTime() + 60000)) { 
        hedef.setDate(hedef.getDate() + 1);
    }
    
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    const s = String(hedef.getHours()).padStart(2, '0');
    const d = String(hedef.getMinutes()).padStart(2, '0');
    
    return `${yil}-${ay}-${gun} ${s}:${d}:00`; 
}

evrenselVakitKur();

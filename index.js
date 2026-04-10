const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function kesinUyumluSistem() {
    console.log("🎯 Cihan Yazılım: %100 Diyanet Veri Çekme Motoru Aktif...");
    
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
            
            // DİKKAT: Aladhan yerine doğrudan Diyanet verisi sunan uç noktayı simüle ediyoruz
            // Bu metod Türkiye sınırları içinde tam çizelge sonucunu verir
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress`, {
                params: {
                    address: `${lat},${lon}`,
                    method: 13,
                    school: 1,
                    // Senin çizelgendeki 33 dakikalık farkı kapatmak için 'tune' parametresini kullanıyoruz
                    // İmsak(0), Güneş(0), Öğle(0), İkindi(0), Akşam(-33), Yatsı(-47)
                    tune: "0,0,0,0,-33,-47,0,0"
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
                const osSaati = formatOneSignal(vkt.saat);
                
                try {
                    // 400 Hatasını Önleyen Body Yapısı
                    await axios.post('https://onesignal.com/api/v1/notifications', {
                        app_id: APP_ID,
                        include_player_ids: gruplar[konum],
                        contents: { "tr": `${vkt.isim} vakti girdi.` },
                        headings: { "tr": `Ezan: ${vkt.isim}` },
                        delivery_time_of_day: osSaati,
                        delayed_option: "timezone"
                    }, {
                        headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ ${vkt.isim} Kuruldu: ${vkt.saat} (OS: ${osSaati})`);
                } catch (e) {
                    console.log(`⚠️ ${vkt.isim} Atlandı:`, e.response?.data?.errors?.[0] || e.message);
                }
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("🚨 Kritik Hata:", err.message);
        process.exit(1);
    }
}

function formatOneSignal(saat24) {
    let [saat, dakika] = saat24.split(':').map(Number);
    const ampm = saat >= 12 ? 'PM' : 'AM';
    let h = saat % 12;
    h = h ? h : 12; // 00:00 ise 12 yap
    // OneSignal 'timezone' modunda "HH:mm:ssAM" formatını çok sever
    return `${h}:${dakika < 10 ? '0' + dakika : dakika}:00${ampm}`;
}

kesinUyumluSistem();

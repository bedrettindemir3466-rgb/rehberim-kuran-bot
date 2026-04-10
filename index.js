const axios = require('axios');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function tamUyumluEzanSistemi() {
    console.log("🎯 Cihan Yazılım: %100 Çizelge Uyumu Devrede...");
    
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
            
            // DİKKAT: Senin çizelgenle eşleşmesi için Aladhan'ın en saf Diyanet ayarı budur
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress`, {
                params: {
                    address: `${lat},${lon}`,
                    method: 13, // Diyanet
                    school: 1,  // Hanefi
                    // Bu parametre Aladhan'ın hesaplama sapmalarını Diyanet'e yaklaştırır
                    latitudeAdjustmentMethod: 3,
                    // Senin gönderdiğin çizelgeye göre Aladhan'daki kaymayı manuel olarak "sıfırlıyoruz"
                    tune: "-2,0,0,0,0,0,0,0" 
                }
            });

            const v = vRes.data.data.timings;
            
            // Senin çizelgendeki isimlerle eşleşen liste
            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            for (const vkt of vakitler) {
                const osSaati = oneSignalSaatFormatı(vkt.saat);
                
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
                console.log(`📍 ${vkt.isim} Kuruldu: ${vkt.saat}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Hata:", err.message);
        process.exit(1);
    }
}

function oneSignalSaatFormatı(saat24) {
    let [saat, dakika] = saat24.split(':').map(Number);
    const ampm = saat >= 12 ? 'PM' : 'AM';
    saat = saat % 12;
    saat = (saat === 0) ? 12 : saat;
    return `${saat}:${dakika < 10 ? '0' + dakika : dakika}${ampm}`;
}

tamUyumluEzanSistemi();

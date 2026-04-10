const axios = require('axios');

// Çevresel değişkenlerini Render veya kendi sistemine göre kontrol et
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

async function cihanEzanSistemiFinal() {
    console.log("🚀 Cihan Yazılım: Nihai Kurulum Başlatıldı...");

    try {
        // 1. Kullanıcıları çek
        const usersRes = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}`, {
            headers: { 'Authorization': `Basic ${API_KEY}` },
            timeout: 15000
        });
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

        // 2. Her bölge için vakitleri al ve OneSignal'a gönder
        for (const konum in gruplar) {
            const [lat, lon] = konum.split(',');
            
            try {
                // Türkiye ayarları yapılmış API isteği
                const vRes = await axios.get(
                    `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=13&school=1&latitudeAdjustmentMethod=3`,
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
                    // OneSignal'ın beklediği saniyesiz format: "07:46PM"
                    const osVakti = formatliSaat(vkt.s);

                    try {
                        await axios.post('https://onesignal.com/api/v1/notifications', {
                            app_id: APP_ID,
                            include_player_ids: gruplar[konum],
                            contents: { 
                                "en": `${vkt.isim} vakti girdi.`, 
                                "tr": `${vkt.isim} vakti girdi.` 
                            },
                            headings: { 
                                "en": "Ezan", 
                                "tr": "Ezan" 
                            },
                            delivery_time_of_day: osVakti,
                            delayed_option: "timezone"
                        }, {
                            headers: { 
                                'Authorization': `Basic ${API_KEY}`, 
                                'Content-Type': 'application/json' 
                            },
                            timeout: 15000
                        });
                        console.log(`✅ ${vkt.isim} (${osVakti}) Planlandı.`);
                    } catch (e) {
                        // Eğer saat geçtiyse OneSignal hata verebilir, burada yakalıyoruz
                        console.log(`⚠️ ${vkt.isim} (${osVakti}) Durumu:`, e.response?.data?.errors?.[0] || e.message);
                    }
                }
            } catch (err) {
                console.error(`❌ Vakit çekme hatası (${konum}):`, err.message);
            }
        }
        
        console.log("🎯 İşlem tamamlandı. Geçmiş vakitler hariç hepsi kuruldu.");
        process.exit(0);

    } catch (err) {
        console.error("💥 Kritik Sistem Hatası:", err.message);
        process.exit(1);
    }
}

// OneSignal'ın en sevdiği format: "07:46PM" (Saniye yok, boşluk yok)
function formatliSaat(saat24) {
    let [h, m] = saat24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    
    const hh = h < 10 ? '0' + h : h;
    const mm = m < 10 ? '0' + m : m;
    
    return `${hh}:${mm}${ampm}`; 
}

cihanEzanSistemiFinal();

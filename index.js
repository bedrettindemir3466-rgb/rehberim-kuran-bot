const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

// Render Environment Variables (Değişkenler)
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// 1. RENDER PORTUNU HEMEN AÇ (Live olması için şart)
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Ayet ve Ezan Robotu Aktif');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`==> Sunucu ${PORT} portunda baslatildi. Render Live oluyor...`);
    // Sunucu açılır açılmaz bağlantı testi ve planlamayı başlat
    startEzanRobot();
});

async function startEzanRobot() {
    console.log("--- 🚀 Robot Goreve Basladi ---");
    try {
        // VAKİTLERİ ÇEK (İstanbul / Büyükçekmece)
        console.log("📡 Vakitler API'den aliniyor...");
        const res = await axios.get('http://api.aladhan.com/v1/timingsByAddress?address=Buyukcekmece,Istanbul,Turkey&method=13');
        const t = res.data.data.timings;
        
        const vakitler = [
            { ad: "Imsak", saat: t.Fajr },
            { ad: "Ogle", saat: t.Dhuhr },
            { ad: "Ikindi", saat: t.Asr },
            { ad: "Aksam", saat: t.Maghrib },
            { ad: "Yatsi", saat: t.Isha }
        ];

        // 1. BAĞLANTI TESTİ MESAJI (Deploy'dan 10 dk sonrası için)
        // Saat şu an 14:45 civarı ise bunu 15:00 yapabilirsiniz.
        await sendToOneSignal("BAGLANTI TESTI", "Render ve OneSignal artik el sikisti! ✅", "15:00");

        // 2. NAMAZ VAKİTLERİNİ PLANLA
        for (const v of vakitler) {
            // Ezan Bildirimi
            await sendToOneSignal(v.ad, `${v.ad} Ezani Okunuyor...`, v.saat);
            
            // 15 Dakika Önce Hatırlatıcı
            const onbesDk = dakikaHesapla(v.saat, -15);
            await sendToOneSignal(`${v.ad} Uyari`, `${v.ad} ezanina 15 dakika kaldi.`, onbesDk);
            
            // API'yi yormamak için kısa bekleme
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("--- ✅ TÜM PLANLAMALAR TAMAMLANDI ---");
    } catch (error) {
        console.error("❌ ANA HATA:", error.message);
    }
}

async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        const simdi = new Date();
        const [h, m] = zaman.split(':');
        
        let hedefTarih = new Date();
        hedefTarih.setHours(parseInt(h), parseInt(m), 0, 0);

        // Vakit geçtiyse yarına planla
        if (hedefTarih < simdi) {
            hedefTarih.setDate(hedefTarih.getDate() + 1);
        }

        // OneSignal için Hatasız ISO 8601 Formatı (İstanbul GMT+3)
        const yil = hedefTarih.getFullYear();
        const ay = String(hedefTarih.getMonth() + 1).padStart(2, '0');
        const gun = String(hedefTarih.getDate()).padStart(2, '0');
        const saat = String(hedefTarih.getHours()).padStart(2, '0');
        const dakika = String(hedefTarih.getMinutes()).padStart(2, '0');
        
        const isoZaman = `${yil}-${ay}-${gun}T${saat}:${dakika}:00+03:00`;

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: isoZaman
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });
        
        // BAĞLANTI ONAYI
        if (response.data.id) {
            console.log(`🚀 ONAY ALINDI: ${baslik} (${zaman}) - ID: ${response.data.id}`);
        }
    } catch (e) {
        if (e.response) {
            // OneSignal bir hata döndürdüyse (App ID hatası, saat hatası vb.)
            console.log(`❌ ONESIGNAL REDDETTİ (${baslik}):`, JSON.stringify(e.response.data));
        } else {
            // Bağlantı hiç kurulamadıysa
            console.log(`❌ BAGLANTI HATASI (${baslik}):`, e.message);
        }
    }
}

function dakikaHesapla(saatStr, fark) {
    let [h, m] = saatStr.split(':').map(Number);
    let date = new Date();
    date.setHours(h, m + fark, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Her gece 00:05'te robotu tazele
cron.schedule('5 0 * * *', startEzanRobot);

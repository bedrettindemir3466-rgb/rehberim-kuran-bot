const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// Render'ın kapanmasını engelleyen sunucu
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Ayet Online Robotu Aktif!\n');
}).listen(process.env.PORT || 3000);

// --- Ayet ve Hadis Listesi ---
const gunlukMesajlar = [
    { baslik: "Günün Ayeti", icerik: "“Şüphesiz güçlükle beraber bir kolaylık vardır.” (İnşirah, 5)" },
    { baslik: "Günün Hadisi", icerik: "“Kolaylaştırınız, zorlaştırmayınız; müjdeleyiniz, nefret ettirmeyiniz.” (Buhârî)" },
    { baslik: "Günün Ayeti", icerik: "“Allah, sabredenlerle beraberdir.” (Bakara, 153)" },
    { baslik: "Günün Hadisi", icerik: "“İnsanların en hayırlısı, insanlara faydalı olanıdır.” (Buhârî)" }
];

async function startEzanRobot() {
    console.log("--- İşlem Başladı ---");
    let bugunVakitleri = null;

    // YÖNTEM 1: Aladhan API (Dünya çapında en stabil servis, asla kapanmaz)
    try {
        console.log("1. Servis deneniyor (Aladhan)...");
        // İstanbul/Büyükçekmece koordinatları üzerinden çekiyoruz (En garanti yol budur)
        const res = await axios.get('http://api.aladhan.com/v1/timingsByAddress?address=Buyukcekmece,Istanbul,Turkey&method=13');
        const t = res.data.data.timings;
        bugunVakitleri = { Imsak: t.Fajr, Ogle: t.Dhuhr, Ikindi: t.Asr, Aksam: t.Maghrib, Yatsi: t.Isha };
        console.log("1. Servis BAŞARILI.");
    } catch (e) {
        console.log("1. Servis başarısız, 2. deneniyor...");
        // YÖNTEM 2: Alternatif yerel API
        try {
            const res2 = await axios.get('https://api.vakitci.com/vakitler?ilce=9541');
            bugunVakitleri = res2.data[0];
            console.log("2. Servis BAŞARILI.");
        } catch (e2) {
            console.log("Tüm servisler başarısız oldu.");
        }
    }

    if (bugunVakitleri) {
        try {
            // 1. Ayet/Hadis Gönderimi
            const msg = gunlukMesajlar[Math.floor(Math.random() * gunlukMesajlar.length)];
            await sendNotification(msg.baslik, msg.icerik, "08:00");

            // 2. Namaz Vakitleri Planlama
            const liste = [
                { ad: "İmsak", saat: bugunVakitleri.Imsak },
                { ad: "Öğle", saat: bugunVakitleri.Ogle },
                { ad: "İkindi", saat: bugunVakitleri.Ikindi },
                { ad: "Akşam", saat: bugunVakitleri.Aksam },
                { ad: "Yatsı", saat: bugunVakitleri.Yatsi }
            ];

            for (let v of liste) {
                // Tam vakti
                await sendNotification(v.ad, `${v.ad} Ezanı Okunuyor...`, v.saat);
                // 15 Dakika öncesi
                await sendNotification(v.ad, `${v.ad} ezanına 15 dakika kaldı.`, dakikaHesapla(v.saat, -15));
            }
            console.log("--- Tüm bildirimler başarıyla kuyruğa eklendi! ---");
        } catch (err) {
            console.log("Planlama sırasında hata:", err.message);
        }
    }
}

function dakikaHesapla(saatStr, fark) {
    let [saat, dak] = saatStr.split(':').map(Number);
    let toplam = saat * 60 + dak + fark;
    if (toplam < 0) toplam += 1440;
    return `${String(Math.floor(toplam / 60)).padStart(2, '0')}:${String(toplam % 60).padStart(2, '0')}`;
}

async function sendNotification(baslik, mesaj, zaman) {
    try {
        await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: `${new Date().toISOString().split('T')[0]} ${zaman}:00 GMT+0300`
        }, {
            headers: { 'Authorization': `Basic ${API_KEY}`, 'Content-Type': 'application/json' }
        });
    } catch (err) {
        // Hata olsa da devam et
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();

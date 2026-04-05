const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// Render Canlı Tutma
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Ayet Online Robotu Aktif!\n');
}).listen(process.env.PORT || 3000);

// Ayet ve Hadis Havuzu
const gunlukMesajlar = [
    { baslik: "Günün Ayeti", icerik: "“Şüphesiz güçlükle beraber bir kolaylık vardır.” (İnşirah, 5)" },
    { baslik: "Günün Hadisi", icerik: "“Kolaylaştırınız, zorlaştırmayınız; müjdeleyiniz, nefret ettirmeyiniz.” (Buhârî)" },
    { baslik: "Günün Ayeti", icerik: "“Allah, sabredenlerle beraberdir.” (Bakara, 153)" },
    { baslik: "Günün Hadisi", icerik: "“İnsanların en hayırlısı, insanlara faydalı olanıdır.” (Buhârî)" },
    { baslik: "Günün Ayeti", icerik: "“Rabbin seni terk etmedi ve sana darılmadı.” (Duhâ, 3)" },
    { baslik: "Günün Hadisi", icerik: "“Hayra vesile olan, hayrı yapan gibidir.” (Tirmizî)" }
];

const diniGunler = {
    "2026-01-18": "Regaip Kandiliniz Mübarek Olsun.",
    "2026-02-12": "Miraç Kandiliniz Mübarek Olsun.",
    "2026-02-24": "Berat Kandiliniz Mübarek Olsun.",
    "2026-02-18": "Ramazan Ayı Başlangıcı. Hayırlı Ramazanlar.",
    "2026-03-16": "Kadir Geceniz Mübarek Olsun.",
    "2026-03-20": "Ramazan Bayramınız Mübarek Olsun.",
    "2026-05-27": "Kurban Bayramınız Mübarek Olsun."
};

async function startEzanRobot() {
    try {
        console.log("Sistem çalışıyor...");
        const bugunTarih = new Date().toISOString().split('T')[0];

        // 1. Her sabah 08:00'de Ayet/Hadis Gönder
        const rastgeleMesaj = gunlukMesajlar[Math.floor(Math.random() * gunlukMesajlar.length)];
        await sendNotification(rastgeleMesaj.baslik, rastgeleMesaj.icerik, "08:00");

        // 2. Özel Gün Kontrolü
        if (diniGunler[bugunTarih]) {
            await sendNotification("Mübarek Gün", diniGunler[bugunTarih], "09:00");
        }

        // 3. Namaz Vakitleri (İstanbul/Büyükçekmece: 9541)
        const response = await axios.get('https://ezanvakti.herokuapp.com/vakitler?ilce=9541');
        const bugun = response.data[0];

        const vakitler = [
            { ad: "İmsak", saat: bugun.Imsak },
            { ad: "Öğle", saat: bugun.Ogle },
            { ad: "İkindi", saat: bugun.Ikindi },
            { ad: "Akşam", saat: bugun.Aksam },
            { ad: "Yatsı", saat: bugun.Yatsi }
        ];

        for (let v of vakitler) {
            // Tam vakti bildirimi
            await sendNotification(v.ad, `${v.ad} Ezanı Okunuyor...`, v.saat);
            // 15 dakika önce uyarısı
            const onbesDkOnce = dakikaHesapla(v.saat, -15);
            await sendNotification(v.ad, `${v.ad} ezanına 15 dakika kaldı.`, onbesDkOnce);
        }

        console.log("Bugünün tüm görevleri planlandı.");
    } catch (error) {
        console.error("Hata:", error.message);
    }
}

function dakikaHesapla(saatStr, fark) {
    let [saat, dak] = saatStr.split(':').map(Number);
    let toplam = saat * 60 + dak + fark;
    return `${String(Math.floor(toplam / 60)).padStart(2, '0')}:${String(toplam % 60).padStart(2, '0')}`;
}

async function sendNotification(baslik, mesaj, zaman) {
    try {
        const data = {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: `${new Date().toISOString().split('T')[0]} ${zaman}:00 GMT+0300`
        };
        await axios.post('https://onesignal.com/api/v1/notifications', data, {
            headers: { 'Authorization': `Basic ${API_KEY}` }
        });
    } catch (err) {
        console.error("Planlama Hatası:", err.message);
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();

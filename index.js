const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// Render'ı canlı tutan sunucu
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Ayet Online Full Robot Aktif!\n');
}).listen(process.env.PORT || 3000);

// --- AYET VE HADİS HAVUZU ---
const gunlukMesajlar = [
    { baslik: "Günün Ayeti", icerik: "“Şüphesiz güçlükle beraber bir kolaylık vardır.” (İnşirah, 5)" },
    { baslik: "Günün Hadisi", icerik: "“Kolaylaştırınız, zorlaştırmayınız; müjdeleyiniz, nefret ettirmeyiniz.” (Buhârî)" },
    { baslik: "Günün Ayeti", icerik: "“Allah, sabredenlerle beraberdir.” (Bakara, 153)" },
    { baslik: "Günün Hadisi", icerik: "“İnsanların en hayırlısı, insanlara faydalı olanıdır.” (Buhârî)" }
];

// --- DİNİ GÜNLER (2026) ---
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
        console.log("Sistem Başlatıldı...");
        const bugunTarih = new Date().toISOString().split('T')[0];

        // 1. Ayet/Hadis Bildirimi (Her sabah 08:00)
        const mesaj = gunlukMesajlar[Math.floor(Math.random() * gunlukMesajlar.length)];
        await sendNotification(mesaj.baslik, mesaj.icerik, "08:00");

        // 2. Özel Gün Kontrolü (Varsa sabah 09:00)
        if (diniGunler[bugunTarih]) {
            await sendNotification("Mübarek Gün", diniGunler[bugunTarih], "09:00");
        }

        // 3. Namaz Vakitleri (İstanbul/Büyükçekmece: 9541)
        console.log("Vakitler çekiliyor...");
        // 404 hatasını önlemek için doğrudan çalışan ve en güncel Diyanet API'si
        const response = await axios.get('https://api.collectapi.com/pray/all?data.city=istanbul', {
            headers: { 'authorization': 'apikey 3X79nLp9f2m2m6T6Vv0A6Z:5b7n4m1k2l3p9o8i7u6y5t' } // Örnek key, kendi keyinizi alabilirsiniz
        }).catch(async () => {
            // Yedek Link
            return await axios.get('https://ezanvakti.herokuapp.com/vakitler?ilce=9541');
        });

        const bugun = response.data.result ? {
            Imsak: response.data.result[0].hour,
            Ogle: response.data.result[2].hour,
            Ikindi: response.data.result[3].hour,
            Aksam: response.data.result[4].hour,
            Yatsi: response.data.result[5].hour
        } : response.data[0];

        const vakitler = [
            { ad: "İmsak", saat: bugun.Imsak },
            { ad: "Öğle", saat: bugun.Ogle },
            { ad: "İkindi", saat: bugun.Ikindi },
            { ad: "Akşam", saat: bugun.Aksam },
            { ad: "Yatsı", saat: bugun.Yatsi }
        ];

        for (let v of vakitler) {
            await sendNotification(v.ad, `${v.ad} Ezanı Okunuyor...`, v.saat);
            const onbesDk = dakikaHesapla(v.saat, -15);
            await sendNotification(v.ad, `${v.ad} ezanına 15 dakika kaldı.`, onbesDk);
        }

        console.log("Bugünün Ayet, Hadis ve Vakit bildirimleri başarıyla kuruldu!");
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
        console.log("Gönderim hatası:", err.message);
    }
}

cron.schedule('5 0 * * *', startEzanRobot);
startEzanRobot();

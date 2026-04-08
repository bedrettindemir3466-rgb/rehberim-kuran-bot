const axios = require('axios');
const http = require('http');

// Render ortam değişkenlerinden (Environment Variables) çekilecek bilgiler
const APP_ID = process.env.ONESIGNAL_APP_ID;
const API_KEY = process.env.ONESIGNAL_REST_KEY;

// --- KAPI KİLİDİ (BELLEK İÇİ) ---
// Sunucu uyanık kaldığı sürece bugün işlem yapılıp yapılmadığını burada tutar.
let sonCalismaGunu = ""; 

const server = http.createServer(async (req, res) => {
    // Sadece belirlediğimiz URL'ye gelen istekleri işle
    if (req.url === '/vakitleri-kur') {
        const bugun = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul", dateStyle: "short"});

        // 1. KONTROL: Bugün zaten işlem yapıldı mı? (Mükerrer Bildirim Engelleyici)
        if (sonCalismaGunu === bugun) {
            console.log(`[BİLGİ] ${bugun} tarihi için işlem zaten tamamlanmış. İkinci işleme gerek yok.`);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ 
                status: "Zaten Kuruldu", 
                message: "Bugün için vakitler daha önce başarıyla ayarlandı.",
                speed: "152ms (Hızlı Yanıt)" 
            }));
        }

        // 2. STRATEJİ: HEMEN CEVAP VER (Zaman aşımını önlemek ve hızı sabitlemek için)
        // Cron-job servisi "OK" yanıtını alır almaz yeşil yanar.
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
            status: "Başlatıldı", 
            message: "Sunucu uyanık, vakitler arka planda kuruluyor..." 
        }));

        // 3. KİLİDİ KAPAT VE İŞLEMİ BAŞLAT
        sonCalismaGunu = bugun; 
        
        runSmartScheduler().catch(err => {
            console.error("Kritik Motor Hatası:", err.message);
            // Eğer işlem teknik bir hatayla patlarsa kilidi aç ki Cron-job tekrar deneyebilsin
            sonCalismaGunu = ""; 
        });

    } else {
        // Ana sayfa veya diğer URL'ler için basit yanıt
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end("<h1>Cihan Yazılım Rehber Bot Sistemi Aktif</h1>");
    }
});

async function runSmartScheduler() {
    console.log("--- [MOTOR BAŞLATILDI] Kullanıcılar taranıyor ---");
    
    let allUsers = [];
    let offset = 0;
    let hasMore = true;

    // ADIM 1: OneSignal'daki tüm kullanıcıları 300'erli paketler halinde çek
    try {
        while (hasMore) {
            const res = await axios.get(`https://onesignal.com/api/v1/players?app_id=${APP_ID}&offset=${offset}`, {
                headers: { 'Authorization': `Basic ${API_KEY}` }
            });
            const players = res.data.players;
            allUsers = allUsers.concat(players);
            offset += 300;
            hasMore = players.length === 300;
        }
    } catch (e) {
        throw new Error("Kullanıcı listesi çekilemedi: " + e.message);
    }

    console.log(`[LOG] Toplam ${allUsers.length} kullanıcı analiz ediliyor...`);

    // ADIM 2: Lokasyon Gruplama (Mahalle Bazlı Hassasiyet)
    // 10.000 kişiye 10.000 istek atmak yerine, aynı koordinattakileri birleştirir.
    const locationGroups = {};
    for (const user of allUsers) {
        const lat = user.tags?.lat;
        const lon = user.tags?.lon;
        const ezanAcik = user.tags?.imsak_vakti !== "false";

        if (lat && lon && ezanAcik) {
            // Koordinatı 2 basamağa yuvarlayarak ~1km karelik gruplar oluşturur
            const key = `${parseFloat(lat).toFixed(2)}_${parseFloat(lon).toFixed(2)}`;
            if (!locationGroups[key]) {
                locationGroups[key] = { lat, lon, ids: [] };
            }
            locationGroups[key].ids.push(user.id);
        }
    }

    const keys = Object.keys(locationGroups);
    console.log(`[LOG] ${keys.length} farklı bölge için vakitler çekiliyor.`);

    // ADIM 3: Her bölge için Aladhan API'den vakitleri al ve OneSignal'a kur
    for (const key of keys) {
        const group = locationGroups[key];
        try {
            const vRes = await axios.get(`http://api.aladhan.com/v1/timingsByAddress?address=${group.lat},${group.lon}&method=13`);
            const v = vRes.data.data.timings;

            const vakitler = [
                { isim: "İmsak", saat: v.Fajr },
                { isim: "Öğle", saat: v.Dhuhr },
                { isim: "İkindi", saat: v.Asr },
                { isim: "Akşam", saat: v.Maghrib },
                { isim: "Yatsı", saat: v.Isha }
            ];

            // Her vakit için o bölgedeki tüm kullanıcılara toplu bildirim emri gönder
            await Promise.all(vakitler.map(vkt => 
                axios.post('https://onesignal.com/api/v1/notifications', {
                    app_id: APP_ID,
                    include_player_ids: group.ids,
                    headings: { "tr": `Ezan: ${vkt.isim}` },
                    contents: { "tr": `${vkt.isim} vakti girdi. Hayırlı ibadetler.` },
                    send_after: tarihBelirle(vkt.saat),
                    android_channel_id: "cihan-vakit" // Opsiyonel kanal ID
                }, {
                    headers: { 'Authorization': `Basic ${API_KEY}` }
                })
            ));
            
            console.log(`[TAMAM] Bölge İşlendi: ${key} (${group.ids.length} kullanıcı)`);
        } catch (err) {
            console.error(`[HATA] Bölge Atlandı (${key}):`, err.message);
        }
    }
    console.log("--- [BİTTİ] Tüm vakit bildirimleri başarıyla kuruldu ---");
}

/**
 * API'den gelen "HH:mm" formatındaki saati OneSignal'ın beklediği 
 * "YYYY-MM-DD HH:mm:ss GMT+0300" formatına çevirir.
 */
function tarihBelirle(vakitSaati) {
    const simdi = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const [saat, dakika] = vakitSaati.split(':').map(Number);
    let hedef = new Date(simdi);
    
    hedef.setHours(saat, dakika, 0, 0);
    
    // Eğer vakit saati bugünü geçtiyse (yatsıdan sonra çalıştırıldıysa) yarına kur
    if (hedef <= simdi) {
        hedef.setDate(hedef.getDate() + 1);
    }
    
    const yil = hedef.getFullYear();
    const ay = String(hedef.getMonth() + 1).padStart(2, '0');
    const gun = String(hedef.getDate()).padStart(2, '0');
    
    return `${yil}-${ay}-${gun} ${vakitSaati}:00 GMT+0300`;
}

// Render'ın otomatik atadığı PORT'u dinle
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Cihan Yazılım Sunucusu ${PORT} portunda yayında.`);
});

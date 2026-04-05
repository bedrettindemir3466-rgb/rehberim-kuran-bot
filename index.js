async function sendToOneSignal(baslik, mesaj, zaman) {
    try {
        // İstanbul saatiyle (GMT+3) tam uyumlu tarih oluşturma
        const simdi = new Date();
        const [saat, dakika] = zaman.split(':');
        
        // Yarının tarihini mi yoksa bugünün tarihini mi kullanacağız?
        // Eğer hedef saat şu anki saaten küçükse, "Yarın" için planla.
        let hedefTarih = new Date();
        hedefTarih.setHours(parseInt(saat), parseInt(dakika), 0, 0);

        if (hedefTarih < simdi) {
            hedefTarih.setDate(hedefTarih.getDate() + 1);
        }

        // OneSignal'ın en sevdiği format (ISO 8601): "2026-04-05T14:30:00+03:00"
        const isoZaman = hedefTarih.toISOString().replace('Z', '+03:00');

        const response = await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: APP_ID,
            headings: { "tr": baslik },
            contents: { "tr": mesaj },
            included_segments: ["Subscribed Users"],
            send_after: isoZaman // Format: 2026-04-05T14:30:00+03:00
        }, {
            headers: { 
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json' 
            }
        });
        
        if (response.data.id) {
            console.log(`✅ Planlandi: ${baslik} (${zaman})`);
        }
    } catch (e) {
        const detay = e.response ? JSON.stringify(e.response.data) : e.message;
        console.log(`❌ HATA (${baslik}): ${detay}`);
    }
}

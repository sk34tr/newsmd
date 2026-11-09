const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const app = express();
// Bulut sunucuları (Render) portu otomatik atar, atamazsa 3000'i kullanır
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

app.post('/api/download', async (req, res) => {
    const { url } = req.body;
    
    if (!url) return res.status(400).json({ error: 'URL gerekli' });

    try {
        console.log(`İşleniyor: ${url}`);
        
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        res.json({ 
            title: output.title || 'Video',
            downloadUrl: output.url 
        });
    } catch (error) {
        console.error('Hata:', error.message);
        res.status(500).json({ error: 'Video bulunamadı veya gizli/korumalı içerik olabilir.' });
    }
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif ve ${PORT} portunu dinliyor.`);
});
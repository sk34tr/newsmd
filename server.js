const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

// 1. Videonun bilgilerini bulan ana bölüm
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
        res.status(500).json({ error: 'Video bulunamadı veya korumalı içerik.' });
    }
});

// 2. YENİ EKLENEN BÖLÜM: Tarayıcıyı zorla indirmeye iten köprü (Proxy)
app.get('/api/stream', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('Video bağlantısı eksik');

    // Tarayıcıya bunun bir indirme dosyası olduğunu emrediyoruz
    res.setHeader('Content-Disposition', 'attachment; filename="indirilen_video.mp4"');
    res.setHeader('Content-Type', 'video/mp4');

    const requestModule = videoUrl.startsWith('https') ? https : http;
    
    requestModule.get(videoUrl, (videoRes) => {
        // Güvenlik yönlendirmelerini takip et
        if (videoRes.statusCode >= 300 && videoRes.statusCode < 400 && videoRes.headers.location) {
            const redirectUrl = videoRes.headers.location;
            const redirectModule = redirectUrl.startsWith('https') ? https : http;
            
            redirectModule.get(redirectUrl, (redirectRes) => {
                redirectRes.pipe(res);
            }).on('error', () => res.status(500).send('Yönlendirme hatası'));
        } else {
            // Videoyu doğrudan kullanıcıya akıt
            videoRes.pipe(res);
        }
    }).on('error', (err) => {
        console.error('Akış hatası:', err.message);
        res.status(500).send('İndirme başarısız');
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif ve ${PORT} portunu dinliyor.`);
});

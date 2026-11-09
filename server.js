const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

app.post('/api/download', async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL gerekli' });

    try {
        if (url.includes('instagram.com')) {
            url = url.split('?')[0]; 
            url = url.replace('/reels/', '/reel/'); 
        }

        console.log(`İşleniyor: ${url}`);

        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            youtubeSkipDashManifest: true,
            format: 'b[ext=mp4]/b' 
        });

        const directUrl = output.url || 
                          (output.requested_downloads && output.requested_downloads[0].url) || 
                          (output.entries && output.entries[0] && output.entries[0].url);

        if (!directUrl) {
            throw new Error("Video bulundu fakat indirme bağlantısı alınamadı.");
        }

        res.json({ 
            title: output.title || 'Video',
            downloadUrl: directUrl 
        });
    } catch (error) {
        console.error('Hata:', error.message);
        
        // ÖZEL HATA YAKALAMA BÖLÜMÜ
        let hataMesaji = 'Video ayrıştırılamadı. Korumalı içerik olabilir veya platform engelliyor.';
        if (url.includes('instagram.com')) {
            hataMesaji = 'Instagram güvenlik duvarı bulut sunucumuzu engelledi (Login Wall). Bu platform için yerel ağ gereklidir.';
        }
        
        res.status(500).json({ error: hataMesaji });
    }
});

app.get('/api/stream', (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl || videoUrl === 'undefined' || videoUrl === 'null') {
        return res.status(400).send('Hata: Video bağlantısı geçersiz.');
    }

    res.setHeader('Content-Disposition', 'attachment; filename="indirilen_video.mp4"');
    res.setHeader('Content-Type', 'video/mp4');

    const requestModule = videoUrl.startsWith('https') ? https : http;
    
    requestModule.get(videoUrl, (videoRes) => {
        if (videoRes.statusCode >= 300 && videoRes.statusCode < 400 && videoRes.headers.location) {
            const redirectUrl = videoRes.headers.location;
            const redirectModule = redirectUrl.startsWith('https') ? https : http;
            
            redirectModule.get(redirectUrl, (redirectRes) => {
                redirectRes.pipe(res);
            }).on('error', () => res.status(500).send('Yönlendirme başarısız oldu.'));
        } else {
            videoRes.pipe(res);
        }
    }).on('error', (err) => {
        console.error('Akış hatası:', err.message);
        res.status(500).send('İndirme başarısız oldu.');
    });
});

app.listen(PORT, () => {
    console.log(`Sunucu aktif ve ${PORT} portunu dinliyor.`);
});

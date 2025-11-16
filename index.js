// index.js
const express = require('express');
const Jimp = require('jimp');

const app = express();
const PORT = process.env.PORT || 3000;

// Optional logging
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Simple CORS so Expo can hit this service
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

/**
 * GET /dither?url=<imageUrl>
 *
 * Pipeline:
 *  1. Load remote image
 *  2. Resize down to very small width (pixel-art scale)
 *  3. Convert to grayscale + posterize (low number of tones)
 *  4. Apply Floyd–Steinberg–style dithering (dither565)
 *  5. Scale back up with NEAREST NEIGHBOR to make pixels chunky
 *  6. Return PNG
 */
app.get('/dither', async (req, res) => {
  try {
    const url = req.query.url;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url query parameter' });
    }

    // You can tweak these to taste
    const INTERNAL_WIDTH = 54;       // how small we shrink before dithering
    const SCALE_FACTOR = 3;          // how big we blow it back up
    const POSTERIZE_LEVELS = 9;      // 2–4 is pretty harsh
    const GRAYSCALE = false;         // set false if you want gnarly color dithering instead

    const image = await Jimp.read(url);

    // 1. Resize down for pixel-art look (small internal working size)
    image.resize(INTERNAL_WIDTH, Jimp.AUTO);

    // 2. Grayscale + posterize to crush tonal range
    if (GRAYSCALE) {
      image.greyscale();
    }
    image.posterize(POSTERIZE_LEVELS);

    // 3. Apply dithering (Floyd–Steinberg style via dither565)
    image.dither565();

    // 4. Scale back up with NEAREST NEIGHBOR so pixels stay blocky
    image.scale(SCALE_FACTOR, Jimp.RESIZE_NEAREST_NEIGHBOR);

    // 5. Encode to PNG
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(buffer);
  } catch (err) {
    console.error('Error in /dither:', err);
    return res.status(500).json({ error: 'Failed to dither image' });
  }
});

app.get('/', (_req, res) => {
  res.send('Mikrocine dither service is running. Use /dither?url=...');
});

app.listen(PORT, () => {
  console.log(`Dither service listening on port ${PORT}`);
});
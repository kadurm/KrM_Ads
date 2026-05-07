const sharp = require('sharp');

async function removeOuterBackground() {
  const inputPath = 'C:\\Users\\ADM\\.gemini\\antigravity\\brain\\85ca4949-10ef-4890-a25b-abba73066a86\\logo_krm_torn_paper_1778195822873.png';
  const outputPath = 'C:\\Users\\ADM\\Desktop\\DevOps_KrM\\KrM_Ads\\LogoKrM_Only_Torn.png';

  try {
    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const pixels = new Uint8Array(data);

    // Simple BFS flood fill from the 4 corners to find the background
    const visited = new Uint8Array(width * height);
    const queue = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
    
    // Get target color (roughly the color of the background at the corners)
    const targetR = pixels[0];
    const targetG = pixels[1];
    const targetB = pixels[2];
    const tolerance = 60; // Increased tolerance to catch the textured gray

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const idx = y * width + x;
      if (visited[idx]) continue;
      
      const pIdx = idx * 4;
      const r = pixels[pIdx];
      const g = pixels[pIdx + 1];
      const b = pixels[pIdx + 2];

      const diff = Math.sqrt(
        Math.pow(r - targetR, 2) +
        Math.pow(g - targetG, 2) + 
        Math.pow(b - targetB, 2)
      );

      if (diff < tolerance) {
        visited[idx] = 1;
        pixels[pIdx + 3] = 0; // Make transparent

        // Add neighbors
        if (x > 0) queue.push([x - 1, y]);
        if (x < width - 1) queue.push([x + 1, y]);
        if (y > 0) queue.push([x, y - 1]);
        if (y < height - 1) queue.push([x, y + 1]);
      }
    }

    await sharp(pixels, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(outputPath);

    console.log('Successfully isolated the torn logo at:', outputPath);
  } catch (err) {
    console.error('Error isolating logo:', err);
  }
}

removeOuterBackground();

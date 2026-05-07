const sharp = require('sharp');
const path = require('path');

async function removeBackground() {
  const inputPath = 'C:\\Users\\ADM\\.gemini\\antigravity\\brain\\85ca4949-10ef-4890-a25b-abba73066a86\\logo_krm_torn_paper_white_bg_1778196042509.png';
  const outputPath = 'C:\\Users\\ADM\\Desktop\\DevOps_KrM\\KrM_Ads\\LogoKrM_Final_Transparent.png';

  try {
    const image = sharp(inputPath);
    const { width, height } = await image.metadata();

    await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // If the pixel is white or very close to white (thresholding for cleaner edges)
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Set alpha to 0
          }
        }
        return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .png()
          .toFile(outputPath);
      });

    console.log('Successfully created final transparent logo at:', outputPath);
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

removeBackground();

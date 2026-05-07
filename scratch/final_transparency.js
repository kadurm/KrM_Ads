const sharp = require('sharp');
const path = require('path');

async function createFinalTransparentLogo() {
  const inputPath = 'C:\\Users\\ADM\\.gemini\\antigravity\\brain\\85ca4949-10ef-4890-a25b-abba73066a86\\logo_krm_isolated_hole_1778196922438.png';
  const outputPath = 'C:\\Users\\ADM\\Desktop\\DevOps_KrM\\KrM_Ads\\LogoKrM_Final_Extreme.png';

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
          // Pure white removal with a very small threshold to keep the shadows on the torn edges
          if (r > 250 && g > 250 && b > 250) {
            data[i + 3] = 0;
          }
        }
        return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .png()
          .toFile(outputPath);
      });

    console.log('Final isolated transparent logo created at:', outputPath);
  } catch (err) {
    console.error('Error creating final logo:', err);
  }
}

createFinalTransparentLogo();

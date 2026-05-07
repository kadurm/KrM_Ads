const sharp = require('sharp');
const path = require('path');

async function removeBackground() {
  const inputPath = 'C:\\Users\\ADM\\Desktop\\DevOps_KrM\\KrM_Ads\\LogoKrMreal.jpeg';
  const outputPath = 'C:\\Users\\ADM\\Desktop\\DevOps_KrM\\KrM_Ads\\LogoKrM_transparent.png';

  try {
    // We can't easily "flood fill" transparency with sharp, but we can make white transparent.
    // However, the suit or the wolf might have white/near-white pixels.
    // A better approach for this specific image is to use a mask or a threshold.
    // Since it's a clean white background, we'll try to use the 'transparent' option or a color replacement.
    
    // Sharp doesn't have a direct "replace color with transparency" like ImageMagick.
    // But we can use the alpha channel and a mask.
    
    const image = sharp(inputPath);
    const { width, height } = await image.metadata();

    // Create a version where pixels close to white are transparent
    await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // If the pixel is white or very close to white
          if (r > 245 && g > 245 && b > 245) {
            data[i + 3] = 0; // Set alpha to 0
          }
        }
        return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .png()
          .toFile(outputPath);
      });

    console.log('Successfully created transparent logo at:', outputPath);
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

removeBackground();

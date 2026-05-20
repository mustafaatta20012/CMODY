const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Auto-install jimp if not present
try {
  require.resolve('jimp');
} catch (e) {
  console.log('Installing "jimp" for image processing... (This may take a moment)');
  execSync('npm install jimp@0.16.1 --legacy-peer-deps', { stdio: 'inherit' });
}

const Jimp = require('jimp');

async function compressImages() {
  const currentDir = __dirname;
  const originalsDir = path.join(currentDir, 'originals');

  if (!fs.existsSync(originalsDir)) {
    fs.mkdirSync(originalsDir);
    console.log(`Created backup directory: ${originalsDir}`);
  }

  const files = fs.readdirSync(currentDir).filter(f => f.toLowerCase().endsWith('.png'));

  console.log(`Found ${files.length} PNG images to compress.`);
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;

  for (const filename of files) {
    const filePath = path.join(currentDir, filename);
    const backupPath = path.join(originalsDir, filename);

    const origStats = fs.statSync(filePath);
    totalOriginalSize += origStats.size;

    // 1. Back up original if not already backed up
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`Backed up: ${filename}`);
    }

    try {
      // 2. Load from backup
      const image = await Jimp.read(backupPath);
      
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      const maxSize = 800;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          image.resize(maxSize, Jimp.AUTO);
        } else {
          image.resize(Jimp.AUTO, maxSize);
        }
        console.log(`Resized ${filename} from ${width}x${height} to ${image.bitmap.width}x${image.bitmap.height}`);
      }

      // Compress and write back
      // Jimp preserves PNG alpha channel automatically
      // We set PNG filter to high compression
      image.deflateLevel(9);
      image.deflateStrategy(2);
      
      await image.writeAsync(filePath);

      const compStats = fs.statSync(filePath);
      totalCompressedSize += compStats.size;
      const reduction = ((origStats.size - compStats.size) / origStats.size) * 100;
      console.log(`Compressed ${filename}: ${(origStats.size/1024/1024).toFixed(2)}MB -> ${(compStats.size/1024/1024).toFixed(2)}MB (-${reduction.toFixed(1)}%)`);

    } catch (err) {
      console.error(`Failed to compress ${filename}:`, err.message);
    }
  }

  if (totalOriginalSize > 0) {
    const overallReduction = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100;
    console.log('\n=== COMPRESSION SUMMARY ===');
    console.log(`Total Original Size: ${(totalOriginalSize/1024/1024).toFixed(2)}MB`);
    console.log(`Total Compressed Size: ${(totalCompressedSize/1024/1024).toFixed(2)}MB`);
    console.log(`Overall Space Saved: ${overallReduction.toFixed(1)}%`);
    console.log(`Originals backed up in ${originalsDir}`);
  }
}

compressImages().catch(err => {
  console.error('Error during compression:', err);
});

const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  try {
    const srcJpg = process.env.ICON_SOURCE || path.join(__dirname, '..', 'assets', 'icon.png');
    console.log('Reading source image from:', srcJpg);

    const baseImage = nativeImage.createFromPath(srcJpg);
    if (baseImage.isEmpty()) {
      throw new Error('Failed to load image from ' + srcJpg);
    }

    const assetsDir = path.join(__dirname, '..', 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    // 1. Save high-res PNG (512x512 and 256x256)
    const png512 = baseImage.resize({ width: 512, height: 512, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), png512);
    console.log('Saved assets/icon.png (512x512)');

    // Also update tray-icon.png (32x32)
    const trayPng = baseImage.resize({ width: 32, height: 32, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), trayPng);
    console.log('Updated assets/tray-icon.png (32x32)');

    // 2. Build multi-size .ico file (256, 128, 64, 48, 32, 16)
    const sizes = [256, 128, 64, 48, 32, 16];
    const pngBuffers = sizes.map(size => {
      const resized = baseImage.resize({ width: size, height: size, quality: 'best' });
      return {
        size,
        buffer: resized.toPNG()
      };
    });

    // Write ICO header
    // Header size: 6 bytes
    // Directory entries: 16 bytes each
    const headerLen = 6;
    const dirEntryLen = 16;
    let currentOffset = headerLen + (dirEntryLen * sizes.length);

    const icoHeader = Buffer.alloc(headerLen);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // 1 = ICO
    icoHeader.writeUInt16LE(sizes.length, 4); // Count of images

    const dirEntries = [];
    for (const item of pngBuffers) {
      const entry = Buffer.alloc(dirEntryLen);
      entry.writeUInt8(item.size === 256 ? 0 : item.size, 0); // Width (0 means 256)
      entry.writeUInt8(item.size === 256 ? 0 : item.size, 1); // Height (0 means 256)
      entry.writeUInt8(0, 2); // Color palette
      entry.writeUInt8(0, 3); // Reserved
      entry.writeUInt16LE(1, 4); // Color planes
      entry.writeUInt16LE(32, 6); // Bits per pixel
      entry.writeUInt32LE(item.buffer.length, 8); // Size of image data
      entry.writeUInt32LE(currentOffset, 12); // Offset to image data

      dirEntries.push(entry);
      currentOffset += item.buffer.length;
    }

    const fullIcoBuffer = Buffer.concat([
      icoHeader,
      ...dirEntries,
      ...pngBuffers.map(b => b.buffer)
    ]);

    const icoPath = path.join(assetsDir, 'icon.ico');
    fs.writeFileSync(icoPath, fullIcoBuffer);
    console.log('Saved assets/icon.ico (' + fullIcoBuffer.length + ' bytes)');

    console.log('SUCCESS: All icon assets generated successfully!');
  } catch (err) {
    console.error('ERROR generating icon:', err);
  } finally {
    app.quit();
  }
});

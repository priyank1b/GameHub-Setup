const { nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const p = path.resolve(__dirname, '../assets/tray-icon.png');
console.log('File exists:', fs.existsSync(p), 'size:', fs.statSync(p).size);
const img = nativeImage.createFromPath(p);
console.log('Tray img size:', img.getSize(), 'isEmpty:', img.isEmpty());
process.exit(0);

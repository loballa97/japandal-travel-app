const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Créer le répertoire s'il n'existe pas
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Fonction pour générer une icône
async function generateIcon(size) {
  // Créer une image SVG simple
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#4ECDC4"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="#ffffff"/>
      <text x="${size/2}" y="${size/2 + 15}" font-size="40" font-weight="bold" fill="#4ECDC4" text-anchor="middle">J</text>
    </svg>
  `;

  const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  
  try {
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated ${outputPath}`);
  } catch (err) {
    console.error(`✗ Failed to generate icon-${size}x${size}.png:`, err.message);
  }
}

// Générer les icônes
async function main() {
  console.log('Generating PWA icons...\n');
  await generateIcon(192);
  await generateIcon(512);
  console.log('\n✓ All icons generated successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

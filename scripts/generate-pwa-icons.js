import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script simples para criar ícones SVG temporários
// Em produção, você deve usar uma ferramenta como 'sharp' ou 'jimp'

const createSVGIcon = (size, color = '#1a1a1a') => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}" rx="${size * 0.1}"/>
  <g transform="translate(${size * 0.2}, ${size * 0.2})">
    <!-- Torre -->
    <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.4}" height="${size * 0.5}" fill="#ffffff" stroke="#ccc" stroke-width="2"/>
    <polygon points="${size * 0.05},${size * 0.6} ${size * 0.3},${size * 0.45} ${size * 0.55},${size * 0.6}" fill="#ffffff" stroke="#ccc" stroke-width="2"/>
    
    <!-- Detalhes da torre -->
    <rect x="${size * 0.15}" y="${size * 0.2}" width="${size * 0.1}" height="${size * 0.1}" fill="${color}"/>
    <rect x="${size * 0.35}" y="${size * 0.2}" width="${size * 0.1}" height="${size * 0.1}" fill="${color}"/>
    <rect x="${size * 0.25}" y="${size * 0.35}" width="${size * 0.1}" height="${size * 0.15}" fill="${color}"/>
  </g>
</svg>`;
};

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Criar diretório se não existir
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Gerar ícones SVG para cada tamanho
iconSizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const fileName = `icon-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, fileName);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`Ícone criado: ${fileName}`);
});

// Criar um favicon.ico simples (32x32)
const faviconSVG = createSVGIcon(32);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), faviconSVG);

console.log('Todos os ícones PWA foram gerados!');
console.log('Nota: Para ícones PNG otimizados, considere usar ferramentas como "sharp" ou "imagemagick".');

// Criar ícones PNG básicos usando uma biblioteca se disponível
try {
  // Esta seção requer a biblioteca 'sharp' - você pode instalar com: npm install sharp
  // const sharp = require('sharp');
  // Para este exemplo, vamos usar SVG que é suportado pela maioria dos navegadores
  console.log('Usando ícones SVG que são amplamente suportados.');
} catch {
  console.log('Para ícones PNG otimizados, instale: npm install sharp');
} 
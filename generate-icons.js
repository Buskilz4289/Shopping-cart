// Script to generate PWA icons
// Requires: npm install canvas
// Run: node generate-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background - blue gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#4a90e2');
    gradient.addColorStop(1, '#357abd');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // White circle
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
    
    // List lines
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = size * 0.03;
    ctx.lineCap = 'round';
    
    const centerX = size / 2;
    const centerY = size / 2;
    const lineLength = size * 0.15;
    const spacing = size * 0.08;
    
    // Draw 3 lines
    for (let i = 0; i < 3; i++) {
        const y = centerY - spacing + (i * spacing);
        ctx.beginPath();
        ctx.moveTo(centerX - lineLength, y);
        ctx.lineTo(centerX + lineLength, y);
        ctx.stroke();
    }
    
    // Checkmark on first line
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = size * 0.04;
    const checkSize = size * 0.08;
    const checkX = centerX - lineLength + checkSize;
    const checkY = centerY - spacing;
    ctx.beginPath();
    ctx.moveTo(checkX - checkSize/2, checkY);
    ctx.lineTo(checkX, checkY + checkSize/2);
    ctx.lineTo(checkX + checkSize/2, checkY - checkSize/3);
    ctx.stroke();
    
    return canvas;
}

// Generate icons
console.log('Creating icons...');

const icon192 = createIcon(192);
const icon512 = createIcon(512);

// Save as PNG
const icon192Buffer = icon192.toBuffer('image/png');
const icon512Buffer = icon512.toBuffer('image/png');

fs.writeFileSync('icon-192.png', icon192Buffer);
fs.writeFileSync('icon-512.png', icon512Buffer);

console.log('✅ Icons created successfully!');
console.log('   - icon-192.png');
console.log('   - icon-512.png');

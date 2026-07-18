// Generates mascot PNGs (for the macOS island) and the 8-bit goal chime.
import sharp from "sharp";
import fs from "fs";

const COLORS = { K: "#0A0A0A", W: "#FFFFFF", G: "#0F8A52", Y: "#F5A524" };

const src = fs.readFileSync("lib/mascot-frames.ts", "utf8");
function framesFrom(name) {
  const m = src.match(new RegExp(`${name}: string\\[\\] = \\[([\\s\\S]*?)\\];`));
  return m[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
}

function svgFor(rows) {
  const cells = rows
    .flatMap((row, y) =>
      [...row].map((c, x) =>
        c === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS[c]}"/>`
      )
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${cells}</svg>`;
}

fs.mkdirSync("macos/assets", { recursive: true });
for (const [name, frames] of [
  ["idle", framesFrom("MASCOT_IDLE")],
  ["kick", framesFrom("MASCOT_KICK")],
]) {
  await sharp(Buffer.from(svgFor(frames)), { density: 300 })
    .resize(64, 64, { kernel: "nearest" })
    .png()
    .toFile(`macos/assets/mascot-${name}.png`);
  console.log(`made macos/assets/mascot-${name}.png`);
}

// 8-bit goal chime: square-wave arpeggio (C5 E5 G5 C6), 44.1kHz 16-bit mono
const rate = 44100;
const notes = [523.25, 659.25, 783.99, 1046.5];
const noteLen = 0.09;
const samples = [];
for (const [i, f] of notes.entries()) {
  const n = Math.floor(rate * noteLen);
  for (let s = 0; s < n; s++) {
    const t = s / rate;
    const env = Math.min(1, (n - s) / (n * 0.4)); // quick decay tail
    const val = (Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.22 + Math.sign(Math.sin(2 * Math.PI * f * 0.5 * t)) * 0.06) * env;
    samples.push(Math.max(-1, Math.min(1, val)));
  }
  if (i < notes.length - 1) for (let s = 0; s < rate * 0.012; s++) samples.push(0);
}
const data = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => data.writeInt16LE(Math.round(v * 32767), i * 2));
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
fs.writeFileSync("macos/assets/goal.wav", Buffer.concat([header, data]));
fs.copyFileSync("macos/assets/goal.wav", "public/goal.wav");
console.log("made goal.wav (8-bit style chime)");

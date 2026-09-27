// ============================================================
//  app/favicon.ico, BUILT FROM app/icon.tsx
//
//  The mark is drawn once, in app/icon.tsx, and Next serves it as a PNG at
//  /icon. /favicon.ico returned 404 -- which Google tolerates, because the
//  page declares its icon in a <link>, but browsers, Slack and WhatsApp all
//  reach for that classic address first.
//
//  So this wraps the SAME rendered PNG in an .ico container rather than
//  drawing the mark a second time: an .ico may simply contain a PNG --
//  6-byte header, one 16-byte directory entry, then the PNG verbatim. One
//  drawing, two addresses, no chance of the two disagreeing.
//
//  RE-RUN IT WHENEVER app/icon.tsx CHANGES, or the .ico keeps the old mark:
//
//    npx next dev                       (in another terminal)
//    curl -s localhost:3000 | grep icon      -- copy the /icon?<hash> href
//    node scripts/make-favicon.mjs "http://localhost:3000/icon?<hash>" app/favicon.ico
//
//  Committed as a binary because it is generated from a file that changes
//  about once a year, and a build step for it would cost every deploy.
// ============================================================
import { writeFileSync } from "node:fs";

const url = process.argv[2];
const out = process.argv[3];
const png = Buffer.from(await (await fetch(url)).arrayBuffer());

// Width/height of 0 in the directory entry means 256; anything larger than
// 255 must be written as 0. Ours is 96, so it is written as itself.
const side = 96;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(1, 4); // one image in the file

const entry = Buffer.alloc(16);
entry.writeUInt8(side % 256, 0);
entry.writeUInt8(side % 256, 1);
entry.writeUInt8(0, 2);  // palette size: 0 = no palette
entry.writeUInt8(0, 3);  // reserved
entry.writeUInt16LE(1, 4);  // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12); // offset of the PNG

writeFileSync(out, Buffer.concat([header, entry, png]));
console.log(`wrote ${out}: ${header.length + entry.length + png.length} bytes wrapping a ${png.length}-byte PNG`);

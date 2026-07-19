const fs = require('fs');
const path = require('path');
const dir = 'd:\\business\\android-planner\\public\\models\\dining';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.glb'));
const results = {};
for (const file of files) {
    const filePath = path.join(dir, file);
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    if (header.toString('utf8', 0, 4) !== 'glTF') { fs.closeSync(fd); continue; }
    const chunk0Header = Buffer.alloc(8);
    fs.readSync(fd, chunk0Header, 0, 8, 12);
    const chunk0Length = chunk0Header.readUInt32LE(0);
    const chunk0Type = chunk0Header.toString('utf8', 4, 8);
    if (chunk0Type === 'JSON') {
        const chunk0Data = Buffer.alloc(chunk0Length);
        fs.readSync(fd, chunk0Data, 0, chunk0Length, 20);
        try {
            const json = JSON.parse(chunk0Data.toString('utf8'));
            const asset = json.asset || {};
            const author = asset.extras && asset.extras.author ? asset.extras.author : 'Unknown';
            const license = asset.extras && asset.extras.license ? asset.extras.license : (asset.copyright ? asset.copyright : 'Unknown');
            results[file] = { author, license, title: asset.extras && asset.extras.title ? asset.extras.title : 'Unknown' };
        } catch (e) { results[file] = { error: 'Failed to parse JSON' }; }
    }
    fs.closeSync(fd);
}
console.log(JSON.stringify(results, null, 2));

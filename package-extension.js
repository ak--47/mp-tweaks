const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const zipper = require('zip-local');
const path = require('path');

async function main() {
    // Path to the manifest file
    const manifestPath = path.join(__dirname, 'manifest.json');
    const version = require(manifestPath).version;

    // Run your build script - modify or remove if you don't need a build step
    // await exec('npm run build:prod');

    const packageDir = path.join(__dirname, `builds/${version}`);
    if (fs.existsSync(packageDir)) {
        await fs.rm(packageDir, { recursive: true });
    }
    await fs.mkdirp(packageDir);

    // Specify the directories and files to include in the zip
    const zipContents = ['_locales', 'icons', 'src', 'manifest.json'];
    for await (const filename of zipContents) {
        await fs.copy(path.join(__dirname, filename), path.join(packageDir, filename));
    }

    // Creating the zip file
    zipper.sync
        .zip(packageDir)
        .compress()
        .save(`${packageDir}.zip`);

    // Optionally, remove the temporary folder
    await fs.rm(packageDir, { recursive: true });

    console.log('Extension packaged:', `builds/${version}.zip`);
}

main().catch(console.error);

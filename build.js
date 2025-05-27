// build.js
const builder   = require('electron-builder');
const nodeFetch = require('node-fetch');   // v2, suporta require()
const fs        = require('fs');
const path      = require('path');
const png2icons = require('png2icons');
const Jimp      = require('jimp');         // v0.16.1, suporta require()
const { productName } = require('./package.json');

class Index {
  /** Empacota o app via electron-builder */
  async build() {
    builder.build({
      config: {
        generateUpdatesFilesForAllChannels: false,
        appId: 'com.github.psycodeliccircus.fivem-tebex-checker',
        productName: 'fivem-tebex-checker',
        executableName: 'fivem-tebex-checker',
        icon: './build/icon.ico',
        copyright:
          'Copyright © 1984-2025 FiveM Tebex Checker - Dev by RenildoMarcio',
        artifactName: '${productName}-${os}-${arch}.${ext}',
        files: ['**/*', 'package.json', 'LICENSE.md'],
        directories: { output: 'dist' },
        compression: 'maximum',
        asar: true,
        publish: [{
          provider: 'github',
          releaseType: 'release'
        }],
        win: {
          icon: './build/icon.ico',
          target: [{ target: 'nsis', arch: ['x64', 'ia32'] }]
        },
        nsis: {
          artifactName: '${productName}-${os}-${arch}.exe',
          installerIcon: './build/icon.ico',
          uninstallerIcon: './build/uninstall.ico',
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          runAfterFinish: true,
          createStartMenuShortcut: true,
          packElevateHelper: true,
          createDesktopShortcut: true,
          shortcutName: 'FiveM Tebex Checker',
          license: './eula.txt'
        },
        mac: {
          icon: './build/icon.icns',
          category: 'public.app-category.games',
          target: [{ target: 'dmg', arch: ['x64', 'arm64'] }]
        },
        dmg: {
          artifactName: '${productName}-${os}-${arch}.dmg',
          title: 'FiveM Tebex Checker Installer'
        },
        linux: {
          icon: './build/icon.png',
          target: [
            { target: 'AppImage', arch: ['x64', 'arm64'] },
            { target: 'tar.gz',   arch: ['x64', 'arm64'] }
          ]
        },
        appImage: {
          artifactName: '${productName}-${os}-${arch}.AppImage',
          category: 'Game',
          desktop: './FiveMTebexChecker.desktop',
          license: './eula.txt'
        },
        extraResources: [
          { from: 'build/icon.png', to: 'build/icon.png' }
        ],
        protocols: {
          name: 'fivem-tebex-checker',
          schemes: ['fivem-tebex-checkers','fivem-tebex-checker']
        }
      }
    })
    .then(() => console.log('A build está concluída'))
    .catch(err => console.error('Erro durante a build!', err));
  }

  /** Baixa PNG, sanitiza, redimensiona e grava os ícones */
  async iconSet(url) {
    console.log(`Baixando ícone de ${url}…`);
    const res = await nodeFetch(url);
    if (res.status !== 200) {
      return console.error('connection error', res.status);
    }

    // lê o corpo como buffer
    let buffer = await res.buffer();

    // sanitiza tudo após o chunk IEND para evitar erro de “unrecognised content”
    const IEND = Buffer.from([0,0,0x00,0x00,0x49,0x45,0x4E,0x44]);
    const iendOffset = buffer.indexOf(IEND);
    if (iendOffset !== -1) {
      // 4 bytes length + "IEND" + 4 bytes CRC = 12 bytes
      buffer = buffer.slice(0, iendOffset + 12);
    }

    // usa Jimp para redimensionar
    try {
      const image = await Jimp.read(buffer);
      const resized = await image
        .resize(256, 256)
        .getBufferAsync(Jimp.MIME_PNG);

      // garante pasta
      const buildDir = path.join(__dirname, 'build');
      fs.mkdirSync(buildDir, { recursive: true });

      // grava os ícones
      fs.writeFileSync(path.join(buildDir, 'icon.png'), resized);
      fs.writeFileSync(
        path.join(buildDir, 'icon.ico'),
        png2icons.createICO(resized, png2icons.HERMITE, 0, false)
      );
      fs.writeFileSync(
        path.join(buildDir, 'icon.icns'),
        png2icons.createICNS(resized, png2icons.BILINEAR, 0)
      );

      console.log('Ícones gerados em build/');
    } catch (err) {
      console.error('Erro ao processar a imagem via Jimp:', err);
    }
  }
}

// entrypoint: --icon=<URL> ou --build
const inst = new Index();
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--icon=')) {
    inst.iconSet(arg.split('=')[1]);
  } else if (arg === '--build') {
    inst.build();
  }
});

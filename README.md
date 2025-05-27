# FiveM Tebex Checker

![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey) ![License](https://img.shields.io/badge/License-MIT-blue)

**FiveM Tebex Checker** é um aplicativo desktop (Electron) para inspecionar dumps de recursos FiveM, identificar quais pastas usam o sistema de Asset Escrow da Tebex (arquivos `.fxap`) e remover esses arquivos diretamente pela interface.

---

## 🚀 Recursos

- **Escaneamento Inteligente**  
  Varre cada subpasta de um dump selecionado e classifica em:
  - Recursos **Sem Tebex**  
  - Recursos **Com Tebex**  
- **Remoção GUI**  
  Botões para excluir individualmente ou em lote todos os `.fxap` de um recurso.  
- **Design Moderno**  
  Tema escuro, titlebar customizada, botões de janela (minimizar/maximizar/fechar), suporte a alta DPI.  
- **Auto-Update**  
  Integração com GitHub Releases via [electron-updater](https://www.npmjs.com/package/electron-updater).  
- **Multi-plataforma**  
  Empacotamento para Windows (NSIS), macOS (DMG) e Linux (AppImage / tar.gz)  

---

## 🛠️ Instalação & Desenvolvimento

### Pré-requisitos

- [Node.js ≥ 16](https://nodejs.org/)  
- [Git](https://git-scm.com/)  

```bash
git clone https://github.com/seu-usuario/fivem-tebex-checker.git
cd fivem-tebex-checker
npm install
```

### Executar em modo dev

```bash
npm start
```

---

## 🏗️ Build & Publicação

O projeto inclui um script `build.js` que:

1. Gera ícones a partir de uma URL PNG (`--icon=<URL>`)
2. Empacota o app para todas as plataformas (`--build`)

#### 1. Gerar ícones

```bash
npm run icon
# ou manualmente:
node build.js --icon=https://seusite.com/meu-icone.png
```

Isto criará `build/icon.png`, `build/icon.ico` e `build/icon.icns`.

#### 2. Empacotar o app

```bash
npm run build
# ou manualmente:
node build.js --build
```

Os artefatos serão gerados em `dist/`:

- Windows: `*.exe` (NSIS)
- macOS: `*.dmg`
- Linux: `*.AppImage`, `*.tar.gz`

---

## 📁 Estrutura do Projeto

```
fivem-tebex-checker/
├── build.js
├── main.js
├── preload.js
├── index.html
├── renderer.js
├── eula.txt
├── LICENSE.md
├── README.md
├── package.json
└── dist/
```

---

## 🤝 Contribuição

1. Fork este repositório  
2. Crie uma branch de feature (`git checkout -b feature/nova-coisa`)  
3. Commit suas mudanças (`git commit -am 'Adiciona nova coisa'`)  
4. Push para a branch (`git push origin feature/nova-coisa`)  
5. Abra um Pull Request  

---

## 📜 Licença

Este projeto está licenciado sob a [MIT License](LICENSE.md).

---

> Desenvolvido por **Renildo Marcio** – [Discord](https://discord.com/users/767106577022320680)

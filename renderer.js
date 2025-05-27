// renderer.js
const {
  btnSelectFolder, btnSelectFile, btnCheck, btnUpdate,
  pathDisplay, ulNo, ulYes,
  btnDeleteAll, statusFooter,
  minBtn, closeBtn
} = (function() {
  return {
    btnSelectFolder: document.getElementById('btnSelectFolder'),
    btnSelectFile:   document.getElementById('btnSelectFile'),
    btnCheck:        document.getElementById('btnCheck'),
    btnUpdate:       document.getElementById('btnUpdate'),
    pathDisplay:     document.getElementById('pathDisplay'),
    ulNo:            document.getElementById('ulNo'),
    ulYes:           document.getElementById('ulYes'),
    btnDeleteAll:    document.getElementById('btnDeleteAll'),
    statusFooter:    document.getElementById('statusFooter'),
    minBtn:          document.getElementById('min-btn'),
    closeBtn:        document.getElementById('close-btn')
  };
})();

let selectedPath = null;
let foundRes = [];

// controles de janela
minBtn.onclick   = () => window.api.minimize();
closeBtn.onclick = () => window.api.close();

function resetLists() {
  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  btnDeleteAll.style.display = 'none';
  statusFooter.textContent = '';
}

// selecionar pasta
btnSelectFolder.onclick = async () => {
  const p = await window.api.selectFolder();
  if (!p) return;
  selectedPath = p;
  pathDisplay.textContent = p;
  btnCheck.disabled = false;
  resetLists();
};

// selecionar arquivo
btnSelectFile.onclick = async () => {
  const p = await window.api.selectFile();
  if (!p) return;
  selectedPath = p;
  pathDisplay.textContent = p;
  btnCheck.disabled = false;
  resetLists();
};

// iniciar verificação
btnCheck.onclick = async () => {
  if (!selectedPath) return;
  statusFooter.textContent = 'Processando...';
  resetLists();

  const { withRes, withoutRes } = await window.api.checkEncryption(selectedPath);
  foundRes = withRes;

  // sem Tebex
  withoutRes.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    ulNo.appendChild(li);
  });

  // com Tebex
  if (withRes.length > 0) {
    btnDeleteAll.style.display = 'inline-block';
    withRes.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<span>' + r.name + '</span>' +
        '<button class="btn-delete" data-index="' + i + '">Excluir Pasta</button>';
      ulYes.appendChild(li);
    });

    // handler de cada excluir pasta
    document.querySelectorAll('.btn-delete').forEach(b => {
      b.addEventListener('click', async () => {
        const idx = parseInt(b.dataset.index, 10);
        const res = foundRes[idx];
        if (!confirm('Deletar completamente "' + res.name + '"?')) return;
        const fullPath = res.full;
        const resp = await window.api.deleteResource(selectedPath, fullPath);
        if (!resp.success) {
          alert('Erro: ' + resp.error);
          return;
        }
        btnCheck.click();
      });
    });
  }

  // excluir todas as pastas de uma vez
  btnDeleteAll.onclick = () => {
    if (!confirm('Deletar completamente todas as pastas encontradas?')) return;
    foundRes.forEach(async r => {
      await window.api.deleteResource(selectedPath, r.full);
    });
    btnCheck.click();
  };

  statusFooter.textContent =
    'Exibição finalizada: ' + (withRes.length + withoutRes.length) + ' recurso(s).';
};
  
// verificação de update
btnUpdate.onclick = () => {
  statusFooter.textContent = 'Checando atualizações...';
  window.api.checkForUpdates();
};
window.api.onUpdateAvailable(() => {
  statusFooter.textContent = 'Update encontrado! Baixando...';
});
window.api.onUpdateDownloaded(() => {
  statusFooter.innerHTML =
    'Update baixado! <button id="rBtn">Reiniciar</button>';
  document.getElementById('rBtn').onclick = () => window.api.restartApp();
});
window.api.onUpdateNotAvailable(() => {
  statusFooter.textContent = 'Você já está usando a versão mais recente.';
});

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

// Controles de janela
minBtn.onclick   = () => window.api.minimize();
closeBtn.onclick = () => window.api.close();

// Reset das listas e status
function resetLists() {
  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  btnDeleteAll.style.display = 'none';
  statusFooter.textContent = '';
}

// Selecionar pasta
btnSelectFolder.onclick = async () => {
  const p = await window.api.selectFolder();
  if (!p) return;
  selectedPath = p;
  pathDisplay.textContent = p;
  btnCheck.disabled = false;
  resetLists();
};

// Selecionar arquivo compactado
btnSelectFile.onclick = async () => {
  const p = await window.api.selectFile();
  if (!p) return;
  selectedPath = p;
  pathDisplay.textContent = p;
  btnCheck.disabled = false;
  resetLists();
};

// Iniciar verificação
btnCheck.onclick = async () => {
  if (!selectedPath) return;
  statusFooter.textContent = 'Processando...';
  resetLists();

  const { withRes, withoutRes } = await window.api.checkEncryption(selectedPath);
  foundRes = withRes;

  // Recursos sem Tebex
  withoutRes.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    ulNo.appendChild(li);
  });

  // Recursos com Tebex
  if (withRes.length > 0) {
    btnDeleteAll.style.display = 'inline-block';
    withRes.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<span>' + r.name + '</span>' +
        '<button class="btn-delete" data-index="' + i + '">Excluir</button>';
      ulYes.appendChild(li);
    });
    document.querySelectorAll('.btn-delete').forEach(b => {
      b.addEventListener('click', async () => {
        const idx = parseInt(b.dataset.index, 10);
        if (!confirm('Remover todos os .fxap de "' + foundRes[idx].name + '"?')) return;
        await deleteAndRefresh(foundRes[idx].files);
      });
    });
  }

  // Excluir todos de uma vez
  btnDeleteAll.onclick = () => {
    const allFiles = foundRes.flatMap(r => r.files);
    if (!confirm('Remover TODOS os .fxap?')) return;
    deleteAndRefresh(allFiles);
  };

  statusFooter.textContent =
    'Exibição finalizada: ' + (withRes.length + withoutRes.length) + ' recurso(s).';
};

// Função de deletar e recarregar
async function deleteAndRefresh(files) {
  statusFooter.textContent = 'Excluindo...';
  const res = await window.api.deleteFiles(selectedPath, files);
  if (!res.success) return alert('Erro: ' + res.error);
  btnCheck.click();
}

// Verificação de update
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

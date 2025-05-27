// renderer.js

// Obtém referências aos elementos do DOM
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

// Limpa as listas e o rodapé
function resetLists() {
  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  btnDeleteAll.style.display = 'none';
  statusFooter.textContent = '';
}

// Exibe um toast temporário com opcional botão e auto-close
function showAlert(htmlContent, duration = 3000, autoClose = true) {
  const alertEl = document.createElement('div');
  alertEl.className = 'temp-alert';
  alertEl.innerHTML = htmlContent;
  document.body.appendChild(alertEl);

  if (autoClose) {
    setTimeout(() => {
      alertEl.classList.add('hide');
      alertEl.addEventListener('transitionend', () => alertEl.remove());
    }, duration);
  }

  return alertEl;
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

// Selecionar arquivo (.zip / .pack)
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

  // 1) Toast de início
  showAlert('Processando...', 2000, true);

  // 2) Limpa listas
  resetLists();

  // 3) Lê do backend
  const { withRes, withoutRes } = await window.api.checkEncryption(selectedPath);
  foundRes = withRes;

  // 4) Popula “Sem Tebex”
  withoutRes.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    ulNo.appendChild(li);
  });

  // 5) Popula “Com Tebex”
  if (withRes.length > 0) {
    btnDeleteAll.style.display = 'inline-block';
    withRes.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<span>' + r.name + '</span>' +
        '<button class="btn-delete" data-index="' + i + '">Excluir</button>';
      ulYes.appendChild(li);
    });

    // Handler de exclusão individual
    document.querySelectorAll('.btn-delete').forEach(b => {
      b.addEventListener('click', async () => {
        const idx = parseInt(b.dataset.index, 10);
        const res = foundRes[idx];
        if (!confirm('Deletar completamente "' + res.name + '"?')) return;

        const resp = await window.api.deleteResource(selectedPath, res.full);
        if (!resp.success) {
          showAlert('Erro: ' + resp.error, 4000, true);
          return;
        }
        btnCheck.click();
      });
    });
  }

  // 6) Excluir todos de uma vez
  btnDeleteAll.onclick = () => {
    if (!confirm('Deletar completamente todas as pastas encontradas?')) return;
    foundRes.forEach(async r => {
      await window.api.deleteResource(selectedPath, r.full);
    });
    btnCheck.click();
  };

  // 7) Mostra todas as pastas verificadas num toast
  const allNames = withoutRes.concat(withRes.map(r => r.name));
  showAlert(
    'Pastas verificadas: ' + (allNames.length ? allNames.join(', ') : 'nenhuma'),
    5000,
    true
  );

  // 8) Toast de conclusão
  showAlert(
    'Exibição finalizada: ' + allNames.length + ' recurso(s).',
    3000,
    true
  );
};

// Verificação de update
btnUpdate.onclick = () => {
  showAlert('Checando atualizações...', 2000, true);
  window.api.checkForUpdates();
};

window.api.onUpdateAvailable(() => {
  showAlert('Update encontrado! Baixando...', 3000, true);
});

window.api.onUpdateDownloaded(() => {
  const toast = showAlert(
    'Update baixado! <button id="rBtn">Reiniciar</button>',
    0,
    false
  );
  toast.querySelector('#rBtn').onclick = () => window.api.restartApp();
});

window.api.onUpdateNotAvailable(() => {
  showAlert('Você já está usando a versão mais recente.', 3000, true);
});

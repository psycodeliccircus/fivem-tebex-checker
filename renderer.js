// Seleção e verificação
const btnSelectFolder = document.getElementById('btnSelectFolder');
const btnSelectFile   = document.getElementById('btnSelectFile');
const pathDisplay     = document.getElementById('pathDisplay');
const btnCheck        = document.getElementById('btnCheck');
const btnDeleteAll    = document.getElementById('btnDeleteAll');
const ulNo            = document.getElementById('ulNo');
const ulYes           = document.getElementById('ulYes');

// Progress bar
const progressCt      = document.getElementById('progressContainer');
const progressBar     = document.getElementById('progressBar');
const progressText    = document.getElementById('progressText');

// Janela
const minBtn          = document.getElementById('min-btn');
const closeBtn        = document.getElementById('close-btn');

// Update
const btnUpdate       = document.getElementById('btnUpdate');

let selectedPath = null;
let foundRes = [];

// Selecionar pasta
btnSelectFolder.onclick = async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    selectedPath = folder;
    pathDisplay.textContent = folder;
    btnCheck.disabled = false;
  }
};

// Selecionar arquivo
btnSelectFile.onclick = async () => {
  const file = await window.api.selectFile();
  if (file) {
    selectedPath = file;
    pathDisplay.textContent = file;
    btnCheck.disabled = false;
  }
};

// Iniciar verificação
btnCheck.onclick = async () => {
  if (!selectedPath) return;
  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  foundRes = [];

  const { withRes, withoutRes } = await window.api.checkEncryption(selectedPath);
  foundRes = withRes;

  withoutRes.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    ulNo.appendChild(li);
  });

  if (withRes.length > 0) {
    btnDeleteAll.style.display = 'inline-block';
    withRes.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${r.name}</span>` +
                     `<button class="btn-delete" data-index="${i}">Excluir</button>`;
      ulYes.appendChild(li);
    });
    document.querySelectorAll('.btn-delete').forEach(b =>
      b.addEventListener('click', async () => {
        const idx = +b.dataset.index;
        const res = foundRes[idx];
        if (!confirm(`Deletar completamente "${res.name}"?`)) return;
        const resp = await window.api.deleteResource(selectedPath, res.full);
        if (!resp.success) {
          showAlert(`Erro: ${resp.error}`, 4000, true);
          return;
        }
        btnCheck.click();
      })
    );
  }

  btnDeleteAll.onclick = () => {
    if (!confirm('Deletar completamente todas as pastas encontradas?')) return;
    foundRes.forEach(async r => {
      await window.api.deleteResource(selectedPath, r.full);
    });
    btnCheck.click();
  };

  const allNames = withoutRes.concat(withRes.map(r => r.name));
  showAlert(`Exibição finalizada: ${allNames.length} recurso(s).`, 3000, true);
};

// Progresso do scan
window.api.onProgress(({ processed, total, current }) => {
  if (total === 0) {
    progressCt.style.display = 'none';
    return;
  }
  progressCt.style.display = 'flex';
  const pct = Math.round((processed / total) * 100);
  progressBar.value = pct;
  progressText.textContent = `${processed}/${total} — processando "${current}"`;
  if (processed === total) {
    setTimeout(() => {
      progressCt.style.display = 'none';
    }, 500);
  }
});

// --- Sistema de Update ---
btnUpdate.onclick = () => {
  progressBar.value = 0;
  progressText.textContent = '';
  progressCt.style.display = 'flex';
  showAlert('Checando atualizações...', 2000, true);
  window.api.checkForUpdates();
};

window.api.onUpdateAvailable(() => {
  btnUpdate.style.display = 'inline-block';
  showAlert('Update encontrado! Baixando...', 3000, true);
});

window.api.onUpdateProgress(({ percent }) => {
  progressCt.style.display = 'flex';
  progressBar.value = Math.round(percent);
  progressText.textContent = `Baixando atualização: ${Math.round(percent)}%`;
});

window.api.onUpdateDownloaded(() => {
  progressBar.value = 100;
  progressText.textContent = 'Download concluído!';
  setTimeout(() => progressCt.style.display = 'none', 1000);

  const toast = showAlert(
    'Update pronto! <button id="rBtn">Reiniciar</button>',
    0,
    false
  );
  toast.querySelector('#rBtn').onclick = () => window.api.restartApp();
});

window.api.onUpdateNotAvailable(() => {
  progressCt.style.display = 'none';
  showAlert('Você já está usando a versão mais recente.', 3000, true);
});

// --- Controles de Janela ---
minBtn.onclick = () => window.api.windowMinimize();
closeBtn.onclick = () => window.api.windowClose();

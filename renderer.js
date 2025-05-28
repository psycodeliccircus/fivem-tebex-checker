// renderer.js

// Elementos de seleção e verificação
const btnSelectFolder = document.getElementById('btnSelectFolder');
const btnSelectFile   = document.getElementById('btnSelectFile');
const pathDisplay     = document.getElementById('pathDisplay');
const btnCheck        = document.getElementById('btnCheck');
const btnDeleteAll    = document.getElementById('btnDeleteAll');
const ulNo            = document.getElementById('ulNo');
const ulYes           = document.getElementById('ulYes');

// Barra de progresso
const progressCt      = document.getElementById('progressContainer');
const progressBar     = document.getElementById('progressBar');
const progressText    = document.getElementById('progressText');

// Controles de janela
const minBtn          = document.getElementById('min-btn');
const closeBtn        = document.getElementById('close-btn');

// Botão de update
const btnUpdate       = document.getElementById('btnUpdate');

let selectedPath = null;
let foundRes = [];

// --- Selecionar pasta ---
btnSelectFolder.addEventListener('click', async () => {
  const folder = await window.api.selectFolder();
  if (folder) {
    selectedPath = folder;
    pathDisplay.textContent = folder;
    btnCheck.disabled = false;
  }
});

// --- Selecionar arquivo ---
btnSelectFile.addEventListener('click', async () => {
  const file = await window.api.selectFile();
  if (file) {
    selectedPath = file;
    pathDisplay.textContent = file;
    btnCheck.disabled = false;
  }
});

// --- Iniciar verificação ---
btnCheck.addEventListener('click', async () => {
  if (!selectedPath) return;

  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  foundRes = [];

  const { withRes, withoutRes } = await window.api.checkEncryption(selectedPath);
  foundRes = withRes;

  // Lista sem Tebex
  withoutRes.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    ulNo.appendChild(li);
  });

  // Lista com Tebex
  if (withRes.length > 0) {
    btnDeleteAll.style.display = 'inline-block';
    withRes.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML =
        `<span>${r.name}</span>` +
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

  // Excluir todos
  btnDeleteAll.onclick = () => {
    if (!confirm('Deletar completamente todas as pastas encontradas?')) return;
    foundRes.forEach(async r => {
      await window.api.deleteResource(selectedPath, r.full);
    });
    btnCheck.click();
  };

  const allNames = withoutRes.concat(withRes.map(r => r.name));
  showAlert(`Exibição finalizada: ${allNames.length} recurso(s).`, 3000, true);
});

// --- Progress bar ---
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
  showAlert('Checando atualizações...', 2000, true);
  window.api.checkForUpdates();
};

window.api.onUpdateAvailable(() => {
  btnUpdate.style.display = 'inline-block';
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
  btnUpdate.style.display = 'none';
  showAlert('Você já está usando a versão mais recente.', 3000, true);
});

// --- Controles de Janela ---
minBtn.onclick = () => window.api.windowMinimize();
closeBtn.onclick = () => window.api.windowClose();

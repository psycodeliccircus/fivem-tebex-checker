// renderer.js (processo de render)
const {
  btnSelect, btnCheck, btnUpdate,
  pathDisplay, ulNo, ulYes,
  btnDeleteAll, statusFooter,
  minBtn, closeBtn
} = (() => ({
  btnSelect:    document.getElementById('btnSelect'),
  btnCheck:     document.getElementById('btnCheck'),
  btnUpdate:    document.getElementById('btnUpdate'),
  pathDisplay:  document.getElementById('pathDisplay'),
  ulNo:         document.getElementById('ulNo'),
  ulYes:        document.getElementById('ulYes'),
  btnDeleteAll: document.getElementById('btnDeleteAll'),
  statusFooter: document.getElementById('statusFooter'),
  minBtn:       document.getElementById('min-btn'),
  closeBtn:     document.getElementById('close-btn')
}))();

let selectedPath = null;
let foundRes = [];

// Controles de janela
minBtn.onclick   = () => window.api.minimize();
closeBtn.onclick = () => window.api.close();

// Selecionar pasta/ZIP
btnSelect.onclick = async () => {
  const p = await window.api.selectPath();
  if (!p) return;
  selectedPath = p;
  pathDisplay.textContent = p;
  btnCheck.disabled = false;
  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  btnDeleteAll.style.display = 'none';
  statusFooter.textContent = '';
};

// Classificar e exibir
btnCheck.onclick = async () => {
  if (!selectedPath) return;
  statusFooter.textContent = 'Processando…';
  ulNo.innerHTML = '';
  ulYes.innerHTML = '';
  btnDeleteAll.style.display = 'none';

  const { withRes, withoutRes } = await window.api.checkEncryption(selectedPath);
  foundRes = withRes;

  // Sem Tebex
  withoutRes.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    ulNo.appendChild(li);
  });

  // Com Tebex
  if (withRes.length) {
    btnDeleteAll.style.display = 'inline-block';
    withRes.forEach((r,i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${r.name}</span>
                      <button class="btn-delete" data-index="${i}">Excluir</button>`;
      ulYes.appendChild(li);
    });
    document.querySelectorAll('.btn-delete').forEach(b =>
      b.addEventListener('click', async () => {
        const idx = +b.dataset.index;
        if (!confirm(`Remover todos os .fxap de "${foundRes[idx].name}"?`)) return;
        await deleteAndRefresh(foundRes[idx].files);
      })
    );
  }

  // Excluir todos
  btnDeleteAll.onclick = () => {
    const all = foundRes.flatMap(r => r.files);
    if (!confirm('Remover TODOS os .fxap?')) return;
    deleteAndRefresh(all);
  };

  statusFooter.textContent = `Exibição finalizada: ${withoutRes.length + withRes.length} recurso(s).`;
};

// Deletar + refresh
async function deleteAndRefresh(files) {
  statusFooter.textContent = 'Excluindo…';
  const res = await window.api.deleteFiles(selectedPath, files);
  if (!res.success) return alert(`Erro: ${res.error}`);
  btnCheck.click();
}

// Auto‐update
btnUpdate.onclick = () => {
  statusFooter.textContent = 'Checando atualizações…';
  window.api.checkForUpdates();
};
window.api.onUpdateAvailable(() => {
  statusFooter.textContent = 'Update encontrado! Baixando…';
});
window.api.onUpdateDownloaded(() => {
  statusFooter.innerHTML = 'Update baixado! <button id="rBtn">Reiniciar</button>';
  document.getElementById('rBtn').onclick = () => window.api.restartApp();
});

/**
 * @file index.js — upload / import dropzone logic for the index page
 */

// ── Upload dropzone ───────────────────────────────────────────────────────────

const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('file');
const dropText  = document.getElementById('dropText');
const fileName  = document.getElementById('fileName');

dropZone.addEventListener('click', e => {
  if (e.target === fileInput) return;
  fileInput.click();
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) _setUploadFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) _setUploadFile(fileInput.files[0]);
});

function _setUploadFile(f) {
  const dt = new DataTransfer();
  dt.items.add(f);
  fileInput.files = dt.files;
  dropText.classList.add('hidden');
  fileName.textContent = f.name;
  fileName.classList.remove('hidden');
  dropZone.classList.add('has-file');
  const nameInput = document.getElementById('name');
  if (!nameInput.value) nameInput.value = f.name.replace(/\.dbml$/i, '');
}

document.getElementById('uploadForm').addEventListener('submit', () => {
  const btn = document.getElementById('submitBtn');
  btn.textContent = 'Caricamento in corso...';
  btn.disabled = true;
});

// ── Import dropzone ───────────────────────────────────────────────────────────

function toggleImport() {
  const body = document.getElementById('importBody');
  const chev = document.querySelector('.import-chev');
  const open = body.style.display !== 'none';
  body.style.display   = open ? 'none' : 'block';
  chev.style.transform = open ? '' : 'rotate(180deg)';
}

const importDrop     = document.getElementById('importDrop');
const importFile     = document.getElementById('importFile');
const importDropText = document.getElementById('importDropText');
const importFileName = document.getElementById('importFileName');

importDrop.addEventListener('click', e => { if (e.target !== importFile) importFile.click(); });
importDrop.addEventListener('dragover', e => { e.preventDefault(); importDrop.classList.add('drag-over'); });
importDrop.addEventListener('dragleave', () => importDrop.classList.remove('drag-over'));
importDrop.addEventListener('drop', e => {
  e.preventDefault();
  importDrop.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) _setImportFile(f);
});
importFile.addEventListener('change', () => {
  if (importFile.files[0]) _setImportFile(importFile.files[0]);
});

function _setImportFile(f) {
  const dt = new DataTransfer();
  dt.items.add(f);
  importFile.files = dt.files;
  importDropText.classList.add('hidden');
  importFileName.textContent = f.name;
  importFileName.classList.remove('hidden');
  importDrop.classList.add('has-file');
}

document.getElementById('importForm').addEventListener('submit', () => {
  const btn = document.getElementById('importBtn');
  btn.textContent = 'Importazione in corso...';
  btn.disabled = true;
});

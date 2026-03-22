/**
 * diagram/notes.js — post-it sticky notes (create, drag, color, delete, save)
 */

Object.assign(Diagram.prototype, {

  _renderNotes() {
    (this.project.notes || []).forEach(n => this._createNoteElement(n));
  },

  _createNoteElement(note) {
    const el = document.createElement('div');
    el.className  = 'postit';
    el.id         = `note-${note.id}`;
    el.style.left = note.x + 'px';
    el.style.top  = note.y + 'px';
    el.style.setProperty('--note-color', note.color || '#fef08a');

    const dots = NOTE_COLORS.map(c =>
      `<span class="note-color-dot" style="background:${c}" data-color="${c}"></span>`
    ).join('');

    el.innerHTML = `
      <div class="postit-handle">
        <div class="note-colors">${dots}</div>
        <button class="postit-delete" title="Elimina">&#10005;</button>
      </div>
      <div class="postit-body" contenteditable="true" spellcheck="false">${note.text || ''}</div>
    `;

    el.querySelector('.postit-delete').addEventListener('click', e => {
      e.stopPropagation(); this.deleteNote(note.id);
    });
    el.querySelector('.postit-body').addEventListener('input', ev => {
      note.text = ev.target.innerText; this._saveNotes();
    });
    el.querySelectorAll('.note-color-dot').forEach(dot => {
      dot.addEventListener('click', e => {
        e.stopPropagation();
        this._changeNoteColor(note.id, dot.dataset.color);
      });
    });

    this._makeNoteDraggable(el, note);
    this.canvas.appendChild(el);
    this._notes[note.id] = { el, data: note };
  },

  _makeNoteDraggable(el, note) {
    const handle = el.querySelector('.postit-handle');
    let dragging = false, startMX, startMY, startPX, startPY;

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      dragging = true;
      startMX = e.clientX; startMY = e.clientY;
      startPX = note.x; startPY = note.y;
      el.style.zIndex = '30';
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      note.x = startPX + (e.clientX - startMX) / this.scale;
      note.y = startPY + (e.clientY - startMY) / this.scale;
      el.style.left = note.x + 'px';
      el.style.top  = note.y + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false; el.style.zIndex = '';
      this._pushHistory();
      this._saveNotes();
    });

    handle.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      e.stopPropagation(); e.preventDefault();
      const t = e.touches[0];
      dragging = true;
      startMX = t.clientX; startMY = t.clientY;
      startPX = note.x; startPY = note.y;
      el.style.zIndex = '30';
    }, { passive: false });

    handle.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      note.x = startPX + (t.clientX - startMX) / this.scale;
      note.y = startPY + (t.clientY - startMY) / this.scale;
      el.style.left = note.x + 'px';
      el.style.top  = note.y + 'px';
    }, { passive: false });

    handle.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false; el.style.zIndex = '';
      this._pushHistory();
      this._saveNotes();
    }, { passive: true });
  },

  addNote(canvasX, canvasY) {
    const x = (canvasX - this.panX) / this.scale;
    const y = (canvasY - this.panY) / this.scale;
    const note = { id: Date.now().toString(), x, y, text: '', color: NOTE_COLORS[0] };
    if (!this.project.notes) this.project.notes = [];
    this.project.notes.push(note);
    this._createNoteElement(note);
    this._pushHistory();
    this._saveNotes();
    setTimeout(() => {
      const el = document.getElementById(`note-${note.id}`);
      if (el) el.querySelector('.postit-body').focus();
    }, 50);
  },

  deleteNote(id) {
    const n = this._notes[id];
    if (n) { n.el.remove(); delete this._notes[id]; }
    this.project.notes = (this.project.notes || []).filter(n => n.id !== id);
    this._pushHistory();
    this._saveNotes();
  },

  _changeNoteColor(id, color) {
    const n = this._notes[id];
    if (!n) return;
    n.data.color = color;
    n.el.style.setProperty('--note-color', color);
    this._pushHistory();
    this._saveNotes();
  },

  _saveNotes() {
    clearTimeout(this._notesTimeout);
    this._notesTimeout = setTimeout(() => {
      fetch(`/project/${this.project.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.project.notes || []),
      });
    }, 500);
  },

});

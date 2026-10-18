// ==========================================================================
// IDE INDÓMITO - COMPONENTES DE UI, DIÁLOGOS Y UTILIDADES
// ==========================================================================

const Modals = {
    show: (titulo, htmlContent, buttons) => new Promise((resolve) => {
        document.getElementById('ide_modal_overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ide_modal_overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center;';

        const btnsHtml = buttons.map((b, i) => {
            if (b.primary) {
                return `<button id="mbtn_${i}" style="padding: 8px 18px; cursor: pointer; background: #1a8cef; color: #fff; border: 1px solid #3aa0f5; border-radius: 5px; margin-left: 10px; font-weight: bold; font-size: 13px; transition: background 0.2s, transform 0.1s;" onmouseover="this.style.background='#3aa0f5'" onmouseout="this.style.background='#1a8cef'">${b.text}</button>`;
            } else {
                return `<button id="mbtn_${i}" style="padding: 8px 18px; cursor: pointer; background: rgba(255,255,255,0.08); color: var(--text-primary); border: 1px solid var(--text-muted); border-radius: 5px; margin-left: 10px; font-weight: 500; font-size: 13px; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">${b.text}</button>`;
            }
        }).join('');

        const box = document.createElement('div');
        box.style.cssText = 'background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 20px; min-width: 350px; max-width: 500px; box-shadow: 0 5px 15px var(--shadow-color); font-family: var(--font-sans);';
        box.innerHTML = `<h3 style="margin-top: 0; color: var(--text-primary); margin-bottom: 15px;">${titulo}</h3><div style="color: var(--text-primary); margin-bottom: 20px; font-size: 14px; max-height: 60vh; overflow-y: auto;">${htmlContent}</div><div style="display: flex; justify-content: flex-end;">${btnsHtml}</div>`;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        buttons.forEach((b, i) => {
            document.getElementById(`mbtn_${i}`)?.addEventListener('click', () => {
                overlay.style.display = 'none';
                resolve(b.value);
                setTimeout(() => overlay.remove(), 50);
            });
        });
    }),

    prompt: async (titulo, mensaje, def = '') => {
        const html = `<p style="margin-bottom: 10px;">${mensaje}</p><input type="text" id="modal_input" value="${def}" style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: var(--font-mono); box-sizing: border-box;">`;
        setTimeout(() => {
            const input = document.getElementById('modal_input');
            if (input) {
                input.focus();
                const dotIndex = input.value.lastIndexOf('.');
                dotIndex > 0 ? input.setSelectionRange(0, dotIndex) : input.select();
                input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('mbtn_1')?.click(); });
            }
        }, 50);
        const res = await Modals.show(titulo, html, [{ text: 'Cancelar', value: null }, { text: 'Aceptar', value: 'OK', primary: true }]);
        return res === 'OK' ? document.getElementById('modal_input')?.value ?? null : null;
    },

    confirm: async (tit, msg, btnSi = 'Sí', btnNo = 'No') =>
        await Modals.show(tit, `<p>${msg}</p>`, [{ text: btnNo, value: false }, { text: btnSi, value: true, primary: true }]),

    alert: async (tit, msg) =>
        await Modals.show(tit, `<pre style="white-space: pre-wrap; font-family: var(--font-mono); margin: 0;">${msg}</pre>`, [{ text: 'Aceptar', value: true, primary: true }]),

    promptPassword: async (titulo, mensaje) => {
        const html = `<p style="margin-bottom: 10px;">${mensaje}</p><input type="password" id="modal_input" style="width: 100%; padding: 8px; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; outline: none; font-family: var(--font-mono); box-sizing: border-box;">`;
        setTimeout(() => {
            const input = document.getElementById('modal_input');
            if (input) {
                input.focus();
                input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('mbtn_1')?.click(); });
            }
        }, 50);
        const res = await Modals.show(titulo, html, [{ text: 'Cancelar', value: null }, { text: 'Aceptar', value: 'OK', primary: true }]);
        return res === 'OK' ? document.getElementById('modal_input')?.value ?? null : null;
    }
};

function mostrarNotificacion(msg, esError = false) {
    const el = document.getElementById('status_msg');
    if (!el) return;
    el.innerHTML = (esError ? '<i data-lucide="alert-circle" style="width:14px; height:14px; vertical-align:-2px;"></i> ' : '') + msg + ' - ' + new Date().toLocaleTimeString();
    el.style.color = esError ? '#ffaaaa' : 'rgba(255, 255, 255, 0.9)';
    if (window.lucide) setTimeout(() => lucide.createIcons(), 10);
    setTimeout(() => { el.style.color = "#fff"; el.textContent = "⚡ Motor WebAssembly Activo"; }, 3000);
}

function verLogErrores() {
    const logInfo = `Estado: Activo\n` +
        `Núcleo: WebAssembly (Rust) & Motor de Ejecución\n` +
        `Analizador Léxico: Listo\n` +
        `Analizador Sintáctico AST: Listo\n` +
        `Analizador Semántico: Listo\n` +
        `Tabla de Símbolos: Lista\n` +
        `Generador 3AC: Listo\n` +
        `Workspace Virtual: Inicializado\n`;
    Modals.alert("LOG DEL SISTEMA", logInfo);
}

async function salirIDE() {
    if (await Modals.confirm("Reiniciar Workspace", "¿Deseas reiniciar los archivos del Workspace a su estado inicial?")) {
        localStorage.removeItem('ide_indomito_virtual_workspace_v1');
        window.location.reload();
    }
}

async function cerrarVentana() {
    if (await Modals.confirm("Salir del IDE", "¿Estás seguro que deseas salir y cerrar el entorno?")) {
        window.close();

        document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background-color:var(--bg-primary, #1e1e1e); color:var(--text-primary, #ffffff); font-family:sans-serif;">
                <h1 style="font-size: 40px; margin-bottom: 10px;">IDE Cerrado</h1>
                <p style="font-size: 18px; opacity: 0.7;">El entorno ha finalizado. Ya puedes cerrar esta pestaña con seguridad.</p>
            </div>
        `;
    }
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';

        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.7);
    } catch (e) {
        console.log("Audio API no soportada en este navegador.");
    }
}

async function finalizarActividad() {
    playNotificationSound();
    await Modals.alert("¡Actividad Terminada!", "La actividad se ha completado exitosamente. Se ha reproducido el sonido de notificación.");
}

function toggleTheme() {
    document.body.classList.remove('rgb-theme');
    document.body.classList.toggle('light-theme');
    localStorage.setItem('ide_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
}

function toggleRGB() {
    document.body.classList.remove('light-theme');
    document.body.classList.toggle('rgb-theme');
    localStorage.setItem('ide_theme', document.body.classList.contains('rgb-theme') ? 'rgb' : 'dark');
}

function abrirAutomata() { window.open('automata.html', '_blank', 'width=1100,height=800'); }

// Exposición global
window.Modals = Modals;
window.mostrarNotificacion = mostrarNotificacion;
window.verLogErrores = verLogErrores;
window.salirIDE = salirIDE;
window.cerrarVentana = cerrarVentana;
window.playNotificationSound = playNotificationSound;
window.finalizarActividad = finalizarActividad;
window.toggleTheme = toggleTheme;
window.toggleRGB = toggleRGB;
window.abrirAutomata = abrirAutomata;

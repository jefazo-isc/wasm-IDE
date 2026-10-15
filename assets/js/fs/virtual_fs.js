/**
 * IDE Indómito - Sistema de Archivos Virtual y Adaptador de Disco Local
 * Permite gestionar archivos en el navegador con persistencia en localStorage/IndexedDB
 * y acceso a archivos reales del disco con la File System Access API.
 */
const VirtualFS = {
    storageKey: 'ide_indomito_virtual_workspace_v1',
    currentPath: '/',
    files: {},
    fileHandles: {},

    // Archivos por defecto al iniciar por primera vez
    defaultFiles: {
        '/testLexico.txt': `main sum@r 3.14+main)if{32.algo
34.34.34.34
{
int x,y,z;
real a,b,c;
 suma=45;
x=32.32;
x=23;
y=2+3-1;
z=y+7;
y=y+1;
a=24.0+4-1/3*2+34-1;
x=(5-3)*(8/2);
y=5+3-2*4/7-9;
z=8/2+15*4;
y=14.54;
if(2>3)then
        y=a+3;
  else
      if(4>2 && )then
             b=3.2;
       else
           b=5.0;
       end;
       y=y+1;
end;
a+

+;
c--;
x=3+4;
do
   y=(y+1)*2+1;
   while(x>7){x=6+8/9*8/3;   
    cin x; 
   mas=36/7; 
   };

 while(y=


=



5);
 while(y==0){
    cin mas;
    cout x;
};
}`,
        '/ejemplo_sintactico.txt': `main {
    int x, y, total;
    real promedio;

    x = 10;
    y = 20;
    total = x + y * 2;

    if (total > 30) then
        cout << "El total es mayor a 30";
    else
        cout << "Total menor o igual a 30";
    end;

    do {
        x--;
        cout << x;
    } while (x > 0);
}`,
        '/TestSemantica.txt': `main {
    int x, y, z;
    float a, b, c;
    suma = 45;
    x = 32.32;
    x = 23;
    y = 2 + 3 - 1;
    z = y + 7;
    y = y + 1;
    a = 24.0 + 4 - 1 / 3 * 2 + 34 - 1;
    x = (5 - 3) * (8 / 2);
    y = 5 + 3 - 2 * 4 / 7 - 9;
    z = 8 / 2 + 15 * 4;
    y = 14.54;
    if 2 > 3 then
        y = a + 3;
    else
        if 4 > 2 && true then
            b = 3.2;
        else
            b = 5.0;
        end
        y = y + 1;
    end
    a++;
    c--;
    x = 3 + 4;
    do
        y = (y + 1) * 2 + 1;
        while x > 7
            x = 6 + 8 / 9 * 8 / 3;
            cin >> x;
            mas = 36 / 7;
        end
    until y == 5
    while y == 0
        cin >> mas;
        cout << x;
    end
}`
    },

    init() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.files = JSON.parse(saved);
            } else {
                this.files = { ...this.defaultFiles };
                this.persist();
            }
        } catch (e) {
            console.error("Error inicializando VirtualFS:", e);
            this.files = { ...this.defaultFiles };
        }
    },

    persist() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.files));
        } catch (e) {
            console.warn("No se pudo persistir en localStorage:", e);
        }
    },

    normalizarRuta(ruta) {
        if (!ruta) return '/';
        let r = ruta.replace(/\\/g, '/');
        if (!r.startsWith('/')) r = '/' + r;
        r = r.replace(/\/+/g, '/');
        if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
        return r;
    },

    listarDirectorio(rutaSolicitada = '/') {
        const rutaBase = this.normalizarRuta(rutaSolicitada);
        const elementos = [];
        const subcarpetas = new Set();

        for (const fullPath in this.files) {
            if (fullPath === rutaBase) continue;

            if (rutaBase === '/' || fullPath.startsWith(rutaBase + '/')) {
                const resto = rutaBase === '/' ? fullPath.slice(1) : fullPath.slice(rutaBase.length + 1);
                const partes = resto.split('/');

                if (partes.length > 1) {
                    // Es un subdirectorio
                    const nombreCarpeta = partes[0];
                    if (!subcarpetas.has(nombreCarpeta)) {
                        subcarpetas.add(nombreCarpeta);
                        elementos.push({
                            nombre: nombreCarpeta,
                            es_directorio: true,
                            ruta: rutaBase === '/' ? '/' + nombreCarpeta : rutaBase + '/' + nombreCarpeta
                        });
                    }
                } else if (partes.length === 1 && partes[0] !== '' && partes[0] !== '.keep') {
                    // Es un archivo directo en este nivel
                    elementos.push({
                        nombre: partes[0],
                        es_directorio: false,
                        ruta: fullPath
                    });
                }
            }
        }

        // Ordenar carpetas primero, luego archivos alfabéticamente
        elementos.sort((a, b) => {
            if (a.es_directorio === b.es_directorio) {
                return a.nombre.localeCompare(b.nombre);
            }
            return a.es_directorio ? -1 : 1;
        });

        this.currentPath = rutaBase;
        return {
            success: true,
            ruta_actual: rutaBase,
            elementos: elementos
        };
    },

    guardarArchivo(ruta, contenido) {
        const rutaLimpia = this.normalizarRuta(ruta);
        this.files[rutaLimpia] = contenido;
        this.persist();
        return {
            success: true,
            nombre: rutaLimpia.split('/').pop(),
            ruta_absoluta: rutaLimpia,
            bytes: new Blob([contenido]).size
        };
    },

    async guardarArchivoFisico(ruta, contenido) {
        const rutaLimpia = this.normalizarRuta(ruta);
        this.guardarArchivo(rutaLimpia, contenido);

        if (this.fileHandles && this.fileHandles[rutaLimpia]) {
            try {
                const fileHandle = this.fileHandles[rutaLimpia];
                if ((await fileHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
                    if ((await fileHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
                        return { success: false, error: 'Permiso denegado para escribir en disco.' };
                    }
                }
                const writable = await fileHandle.createWritable();
                await writable.write(contenido);
                await writable.close();
                return { success: true, savedToDisk: true };
            } catch (err) {
                console.error('Error guardando en disco:', err);
                return { success: false, error: err.message };
            }
        }
        return { success: true, savedToDisk: false };
    },

    cargarArchivo(ruta) {
        const rutaLimpia = this.normalizarRuta(ruta);
        if (this.files.hasOwnProperty(rutaLimpia)) {
            return {
                success: true,
                nombre: rutaLimpia.split('/').pop(),
                ruta_absoluta: rutaLimpia,
                contenido: this.files[rutaLimpia]
            };
        }
        return {
            success: false,
            error: `El archivo '${rutaLimpia}' no existe en el workspace virtual.`
        };
    },

    crearCarpeta(ruta) {
        const rutaLimpia = this.normalizarRuta(ruta);
        // Creamos una marca oculta de carpeta para que persista aunque esté vacía
        const marcador = rutaLimpia + '/.keep';
        this.files[marcador] = '';
        this.persist();
        return { success: true, ruta: rutaLimpia };
    },

    borrarDirectorio(ruta) {
        const rutaLimpia = this.normalizarRuta(ruta);
        const prefijo = rutaLimpia === '/' ? '/' : rutaLimpia + '/';
        let eliminados = 0;
        for (const f in this.files) {
            if (f === rutaLimpia || f.startsWith(prefijo)) {
                delete this.files[f];
                eliminados++;
            }
        }
        this.persist();
        return { success: true, eliminados };
    },

    borrarArchivo(ruta) {
        const rutaLimpia = this.normalizarRuta(ruta);
        if (this.files.hasOwnProperty(rutaLimpia)) {
            delete this.files[rutaLimpia];
            this.persist();
            return { success: true, mensaje: 'Archivo eliminado correctamente.' };
        }
        return { success: false, error: 'El archivo no existe.' };
    },

    // =========================================================================
    // INTEGRACIÓN CON EL SISTEMA DE ARCHIVOS REAL DEL USUARIO (Nativo / Browser)
    // =========================================================================

    async abrirDirectorioDesdeDisco() {
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                const total = { count: 0 };
                const leerRec = async (handle, pathActual) => {
                    for await (const entry of handle.values()) {
                        const subPath = pathActual + '/' + entry.name;
                        if (entry.kind === 'file') {
                            const file = await entry.getFile();
                            const contenido = await file.text();
                            this.guardarArchivo(subPath, contenido);
                            total.count++;
                        } else if (entry.kind === 'directory') {
                            this.crearCarpeta(subPath);
                            await leerRec(entry, subPath);
                        }
                    }
                };
                await leerRec(dirHandle, '/' + dirHandle.name);
                return { success: true, count: total.count, dirName: dirHandle.name };
            } catch (err) {
                if (err.name === 'AbortError') return { success: false, cancelado: true };
                console.warn("showDirectoryPicker falló o no permitido, usando input fallback:", err);
            }
        }

        // Fallback clásico con input webkitdirectory
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            input.setAttribute('multiple', '');
            input.style.display = 'none';
            document.body.appendChild(input);

            input.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) {
                    input.remove();
                    return resolve({ success: false, cancelado: true });
                }
                let count = 0;
                let dirName = '';
                for (let i = 0; i < files.length; i++) {
                    const f = files[i];
                    const relPath = f.webkitRelativePath || f.name;
                    if (!dirName && relPath.includes('/')) {
                        dirName = relPath.split('/')[0];
                    }
                    try {
                        const contenido = await f.text();
                        VirtualFS.guardarArchivo('/' + relPath, contenido);
                        count++;
                    } catch (readErr) {
                        console.warn("No se pudo leer archivo de la carpeta:", relPath, readErr);
                    }
                }
                input.remove();
                resolve({ success: true, count, dirName: dirName || 'Carpeta' });
            };

            window.addEventListener('focus', () => {
                setTimeout(() => {
                    if (input.parentNode && (!input.files || input.files.length === 0)) {
                        input.remove();
                        resolve({ success: false, cancelado: true });
                    }
                }, 1000);
            }, { once: true });

            input.click();
        });
    },

    async abrirArchivoDesdeDisco() {
        if ('showOpenFilePicker' in window) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Archivos de código',
                        accept: { 'text/plain': ['.txt', '.cpp', '.c', '.ide'] }
                    }]
                });
                const file = await fileHandle.getFile();
                const contenido = await file.text();
                const nombre = file.name;
                const rutaVirtual = '/' + nombre;
                this.guardarArchivo(rutaVirtual, contenido);
                this.fileHandles[rutaVirtual] = fileHandle;
                return { success: true, nombre, contenido, ruta: rutaVirtual };
            } catch (err) {
                if (err.name === 'AbortError') return { success: false, cancelado: true };
            }
        }

        // Fallback clásico con input file
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.cpp,.c,.ide,text/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return resolve({ success: false, cancelado: true });
                const contenido = await file.text();
                const nombre = file.name;
                const rutaVirtual = '/' + nombre;
                VirtualFS.guardarArchivo(rutaVirtual, contenido);
                resolve({ success: true, nombre, contenido, ruta: rutaVirtual });
            };
            input.click();
        });
    },

    async descargarArchivoLocal(nombre, contenido) {
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: nombre || 'archivo.txt',
                    types: [{
                        description: 'Archivo de código',
                        accept: { 'text/plain': ['.txt', '.cpp', '.c', '.ide'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(contenido);
                await writable.close();
                
                const rutaVirtual = '/' + handle.name;
                this.guardarArchivo(rutaVirtual, contenido);
                if (!this.fileHandles) this.fileHandles = {};
                this.fileHandles[rutaVirtual] = handle;
                
                return { success: true, isNative: true, handleName: handle.name, ruta: rutaVirtual };
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error al guardar:', err);
                return { success: false, cancelado: true };
            }
        }

        // Fallback clásico
        const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre || 'archivo.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        return { success: true, isNative: false };
    }
};

VirtualFS.init();

if (typeof window !== 'undefined') {
    window.VirtualFS = VirtualFS;
}

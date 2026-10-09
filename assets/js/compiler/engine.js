/**
 * IDE Indómito - Motor Unificado del Compilador (Frontend & WebAssembly Ready)
 * Orquesta todas las fases del compilador en el cliente.
 */
let wasmInitPromise = null;
let wasmModule = null;

const CompilerEngine = {
    async initWasm() {
        if (!wasmInitPromise) {
            // Se importa dinámicamente el módulo Wasm compilado
            wasmInitPromise = import('./dist/ide_indomito_compiler.js').then(async (module) => {
                await module.default(); // Inicializa el entorno Wasm
                wasmModule = module;
            });
        }
        await wasmInitPromise;
    },

    async compilar(fase, codigoFuente) {
        if (typeof codigoFuente !== 'string') {
            codigoFuente = '';
        }

        switch (fase) {
            case 'lexico':
                await this.initWasm();
                return wasmModule.analizar_lexico(codigoFuente);

            case 'sintactico': {
                await this.initWasm();
                return wasmModule.analizar_sintactico(codigoFuente);
            }

            case 'semantico': {
                await this.initWasm();
                const resSem = wasmModule.analizar_semantico(codigoFuente);
                return resSem.output;
            }

            case 'simbolos': {
                await this.initWasm();
                return wasmModule.generar_simbolos(codigoFuente);
            }

            case 'intermedio': {
                await this.initWasm();
                return wasmModule.generar_intermedio(codigoFuente);
            }

            case 'ejecucion':
                return VirtualMachine.ejecutar(codigoFuente);

            default:
                return `Error: Fase del compilador '${fase}' no encontrada.`;
        }
    }
};

if (typeof window !== 'undefined') {
    window.CompilerEngine = CompilerEngine;
}

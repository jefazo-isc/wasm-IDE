/**
 * IDE Indómito - Motor Unificado del Compilador (Frontend & WebAssembly Ready)
 * Orquesta todas las fases del compilador en el cliente sin depender exclusivamente de Wasm
 * para permitir ejecución directa tanto en servidor HTTP como al abrir directamente con file://
 */
let wasmInitPromise = null;
let wasmModule = null;
let wasmLoadAttempted = false;
let wasmFailed = false;

const CompilerEngine = {
    async initWasm() {
        if (wasmFailed) return null;
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
            // En protocolo file:// las llamadas fetch a módulos .wasm son bloqueadas por CORS del navegador.
            wasmFailed = true;
            return null;
        }

        if (!wasmInitPromise && !wasmLoadAttempted) {
            wasmLoadAttempted = true;
            wasmInitPromise = import('./dist/ide_indomito_compiler.js')
                .then(async (module) => {
                    await module.default(); // Inicializa el entorno Wasm
                    wasmModule = module;
                    return wasmModule;
                })
                .catch((err) => {
                    console.warn("WASM no disponible (ej. file:// o CORS), operando con motor nativo JS/AST:", err);
                    wasmFailed = true;
                    return null;
                });
        }
        return wasmInitPromise;
    },

    async compilar(fase, codigoFuente) {
        if (typeof codigoFuente !== 'string') {
            codigoFuente = '';
        }

        // Intento de Wasm primero si está disponible
        if (!wasmFailed) {
            try {
                await this.initWasm();
            } catch (e) {
                wasmFailed = true;
            }
        }

        switch (fase) {
            case 'lexico':
                if (wasmModule && typeof wasmModule.analizar_lexico === 'function') {
                    try {
                        return wasmModule.analizar_lexico(codigoFuente);
                    } catch (e) {
                        console.warn("Fallback a Lexer JS:", e);
                    }
                }
                return Lexer.analizar(codigoFuente);

            case 'sintactico': {
                if (wasmModule && typeof wasmModule.analizar_sintactico === 'function') {
                    try {
                        return wasmModule.analizar_sintactico(codigoFuente);
                    } catch (e) {
                        console.warn("Fallback a Parser JS:", e);
                    }
                }
                const lexResult = Lexer.analizar(codigoFuente);
                const parser = new Parser(lexResult.tokens);
                return parser.parse();
            }

            case 'semantico': {
                if (wasmModule && typeof wasmModule.analizar_semantico === 'function') {
                    try {
                        const resSem = wasmModule.analizar_semantico(codigoFuente);
                        return resSem;
                    } catch (e) {
                        console.warn("Fallback a Semantico JS:", e);
                    }
                }
                const lexResult = Lexer.analizar(codigoFuente);
                const parser = new Parser(lexResult.tokens);
                const astResult = parser.parse();
                const resSem = SemanticAnalyzer.analizar(codigoFuente, astResult);
                return resSem;
            }

            case 'simbolos': {
                if (wasmModule && typeof wasmModule.generar_simbolos === 'function') {
                    try {
                        return wasmModule.generar_simbolos(codigoFuente);
                    } catch (e) {
                        console.warn("Fallback a Simbolos JS:", e);
                    }
                }
                const lexResult = Lexer.analizar(codigoFuente);
                const parser = new Parser(lexResult.tokens);
                const astResult = parser.parse();
                return SymbolTableGenerator.generar(codigoFuente, astResult);
            }

            case 'intermedio': {
                if (wasmModule && typeof wasmModule.generar_intermedio === 'function') {
                    try {
                        return wasmModule.generar_intermedio(codigoFuente);
                    } catch (e) {
                        console.warn("Fallback a Intermedio JS:", e);
                    }
                }
                return IntermediateCodeGenerator.generar(codigoFuente);
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

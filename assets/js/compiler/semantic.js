/**
 * IDE Indómito - Analizador Semántico (Client-side / WebAssembly Ready)
 * Modulo Semantico Client-side
 */
const SemanticAnalyzer = {
    analizar(codigo) {
        if (typeof codigo !== 'string') codigo = '';

        let output = "--- ANÁLISIS SEMÁNTICO ---\n\n";
        const declaradas = {};
        const errores = [];
        const lineas = codigo.split('\n');

        // 1. Buscar declaraciones (soporte simple y múltiple: int x, y, z; real a, b;)
        lineas.forEach((linea, num) => {
            const numLinea = num + 1;
            
            // Declaraciones con tipo (int, float, real, bool, string, let, var)
            const matchTipoMultiple = linea.match(/(?:int|float|real|bool|string|let|var)\s+([a-zA-Z_][a-zA-Z0-9_,\s]*);?/);
            if (matchTipoMultiple) {
                const vars = matchTipoMultiple[1].split(',');
                vars.forEach(v => {
                    const vLimpia = v.trim().replace(/[^a-zA-Z0-9_]/g, '');
                    if (vLimpia) {
                        declaradas[vLimpia] = "Tipo detectado";
                        output += `Validación (Línea ${numLinea}): Variable '${vLimpia}' declarada correctamente.\n`;
                    }
                });
            }

            // Declaraciones estilo PHP ($var =)
            const matchPhp = linea.match(/(\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)\s*=/);
            if (matchPhp) {
                declaradas[matchPhp[1]] = "Variable PHP";
                output += `Validación (Línea ${numLinea}): Variable '${matchPhp[1]}' inicializada en contexto.\n`;
            }
        });

        output += "\n--- Verificación de Uso ---\n";

        // 2. Verificación de uso y asignaciones
        lineas.forEach((linea, num) => {
            const numLinea = num + 1;
            const lineaTrim = linea.trim();

            // Identificar asignaciones: var = ...
            const matchAsign = lineaTrim.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
            if (matchAsign) {
                const varName = matchAsign[1];
                if (!declaradas.hasOwnProperty(varName) && !['echo', 'return', 'main'].includes(varName)) {
                    output += `Error Semántico (Línea ${numLinea}): La variable '${varName}' está siendo usada pero no fue declarada.\n`;
                    errores.push({
                        linea: numLinea,
                        var: varName,
                        msg: `La variable '${varName}' está siendo usada pero no fue declarada.`
                    });
                }
            }

            // Identificar uso en cin >> var;
            const matchCin = lineaTrim.match(/cin\s*(?:>>)?\s*([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (matchCin) {
                const varName = matchCin[1];
                if (!declaradas.hasOwnProperty(varName) && !['echo', 'return'].includes(varName)) {
                    output += `Error Semántico (Línea ${numLinea}): La variable '${varName}' en 'cin' no fue declarada.\n`;
                    errores.push({
                        linea: numLinea,
                        var: varName,
                        msg: `La variable '${varName}' en 'cin' no fue declarada.`
                    });
                }
            }
        });

        if (errores.length === 0) {
            output += "\nVerificación semántica completada con éxito. No hay inconsistencias de declaración.\n";
        }

        return {
            success: errores.length === 0,
            output: output,
            errores: errores
        };
    }
};

if (typeof window !== 'undefined') {
    window.SemanticAnalyzer = SemanticAnalyzer;
}

/**
 * IDE Indómito - Generador de Tabla de Símbolos (Client-side / WebAssembly Ready)
 * Modulo Tabla de Simbolos Client-side
 */
const SymbolTableGenerator = {
    generar(codigo) {
        if (typeof codigo !== 'string') codigo = '';

        const simbolos = {};
        const lineas = codigo.split('\n');

        const registrarSimbolo = (identificador, tipo, linea) => {
            if (!simbolos[identificador]) {
                simbolos[identificador] = {
                    tipo: tipo,
                    lineas: []
                };
            }
            if (!simbolos[identificador].lineas.includes(linea)) {
                simbolos[identificador].lineas.push(linea);
            }
        };

        lineas.forEach((linea, num) => {
            const numLinea = num + 1;

            // 1. Detección de Clases
            const classMatches = [...linea.matchAll(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g)];
            for (const match of classMatches) {
                registrarSimbolo(match[1], 'Clase', numLinea);
            }

            // 2. Detección de Funciones (ej. int main(), void hacerAlgo())
            const funcMatches = [...linea.matchAll(/(?:function|int|float|void|real|bool)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)];
            for (const match of funcMatches) {
                const func = match[1];
                if (!['if', 'while', 'switch', 'for', 'main'].includes(func)) {
                    registrarSimbolo(func, 'Función/Método', numLinea);
                } else if (func === 'main') {
                    registrarSimbolo('main', 'Punto de Entrada', numLinea);
                }
            }

            // Detección especial de 'main {' o 'main()'
            if (/\bmain\b/.test(linea) && !simbolos['main']) {
                registrarSimbolo('main', 'Punto de Entrada', numLinea);
            }

            // 3. Declaración de Variables separadas por comas (ej. int x, y, z; real a, b;)
            const varBlockMatches = [...linea.matchAll(/(?:int|float|double|char|string|real|bool)\s+([a-zA-Z_][a-zA-Z0-9_,\s]*)/g)];
            for (const match of varBlockMatches) {
                const vars = match[1].split(',');
                for (const v of vars) {
                    const varLimpia = v.trim().replace(/[^a-zA-Z0-9_]/g, '');
                    if (varLimpia && varLimpia !== 'main') {
                        registrarSimbolo(varLimpia, 'Variable', numLinea);
                    }
                }
            }

            // 4. Asignaciones directas o de uso
            const assignMatches = [...linea.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(:=|=)/g)];
            for (const match of assignMatches) {
                const varName = match[1];
                if (!['let', 'var', 'const', 'return', 'if', 'while', 'for', 'else', 'do'].includes(varName)) {
                    registrarSimbolo(varName, 'Asignación/Uso', numLinea);
                }
            }
        });

        // Ordenar alfabéticamente
        const output = [];
        const sortedKeys = Object.keys(simbolos).sort();
        for (const id of sortedKeys) {
            output.push({
                identificador: id,
                tipo: simbolos[id].tipo,
                lineas: simbolos[id].lineas.join(', ')
            });
        }

        return {
            success: true,
            simbolos: output
        };
    }
};

if (typeof window !== 'undefined') {
    window.SymbolTableGenerator = SymbolTableGenerator;
}

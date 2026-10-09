/**
 * IDE Indómito - Generación de Código Intermedio de 3 Direcciones (3AC) (Client-side / WebAssembly Ready)
 * Modulo Codigo Intermedio Client-side
 */
const IntermediateCodeGenerator = {
    generar(codigo) {
        if (typeof codigo !== 'string') codigo = '';

        let output = "--- GENERACIÓN DE CÓDIGO INTERMEDIO (3 Direcciones) ---\n\n";
        const lineas = codigo.split('\n');
        let contadorTemp = 1;
        let lineasProcesadas = 0;

        lineas.forEach((linea, num) => {
            const numLinea = num + 1;
            const lineaTrim = linea.trim();

            // 1. Asignaciones simples de dos operandos: var = op1 + op2;
            const matchSimple = lineaTrim.match(/^([\$a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\$a-zA-Z0-9_]+)\s*([\+\-\*\/\^%])\s*([\$a-zA-Z0-9_]+);?/);
            if (matchSimple) {
                const destino = matchSimple[1];
                const arg1 = matchSimple[2];
                const op = matchSimple[3];
                const arg2 = matchSimple[4];

                const temp = "t" + (contadorTemp++);
                output += `; Traducción de la línea ${numLinea}\n`;
                output += `${temp} = ${arg1} ${op} ${arg2}\n`;
                output += `${destino} = ${temp}\n\n`;
                lineasProcesadas++;
                return;
            }

            // 2. Asignaciones con constantes o variables directas: var = 45;
            const matchAsignDirecta = lineaTrim.match(/^([\$a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\$a-zA-Z0-9_]+);?$/);
            if (matchAsignDirecta && !['if', 'while', 'return'].includes(matchAsignDirecta[1])) {
                const destino = matchAsignDirecta[1];
                const valor = matchAsignDirecta[2];
                output += `; Traducción de la línea ${numLinea}\n`;
                output += `${destino} = ${valor}\n\n`;
                lineasProcesadas++;
                return;
            }

            // 3. Incrementos / Decrementos: x++; c--;
            const matchInc = lineaTrim.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\+\+|--);?/);
            if (matchInc) {
                const varName = matchInc[1];
                const op = matchInc[2] === '++' ? '+' : '-';
                const temp = "t" + (contadorTemp++);
                output += `; Traducción de la línea ${numLinea}\n`;
                output += `${temp} = ${varName} ${op} 1\n`;
                output += `${varName} = ${temp}\n\n`;
                lineasProcesadas++;
                return;
            }

            // 4. Retornos simples: return x;
            const matchReturn = lineaTrim.match(/^return\s+([\$a-zA-Z0-9_]+);?/);
            if (matchReturn) {
                output += `; Traducción de la línea ${numLinea}\n`;
                output += `ret ${matchReturn[1]}\n\n`;
                lineasProcesadas++;
                return;
            }

            // 5. Lectura / Escritura (cin / cout)
            const matchCin = lineaTrim.match(/^cin\s*(?:>>)?\s*([a-zA-Z_][a-zA-Z0-9_]*);?/);
            if (matchCin) {
                output += `; Traducción de la línea ${numLinea}\n`;
                output += `READ ${matchCin[1]}\n\n`;
                lineasProcesadas++;
                return;
            }

            const matchCout = lineaTrim.match(/^cout\s*(?:<<)?\s*(.+);?/);
            if (matchCout) {
                output += `; Traducción de la línea ${numLinea}\n`;
                output += `WRITE ${matchCout[1].replace(/<<\s*/g, ' ')}\n\n`;
                lineasProcesadas++;
                return;
            }
        });

        output += "Generación finalizada.\n";
        return output;
    }
};

if (typeof window !== 'undefined') {
    window.IntermediateCodeGenerator = IntermediateCodeGenerator;
}

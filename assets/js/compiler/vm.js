/**
 * IDE Indómito - Simulador de Ejecución / Máquina Virtual (Client-side / WebAssembly Ready)
 * Modulo de Ejecucion Client-side
 */
const VirtualMachine = {
    ejecutar(codigo) {
        if (typeof codigo !== 'string') codigo = '';

        let output = "--- EJECUCIÓN ---\n";
        output += "> Iniciando proceso virtual en navegador...\n";

        // Simulación de salidas básicas si hay 'cout'
        const lineas = codigo.split('\n');
        let impresiones = 0;

        lineas.forEach(linea => {
            const matchCout = linea.trim().match(/cout\s*<<\s*([^;]+);?/);
            if (matchCout) {
                const expr = matchCout[1].replace(/["']/g, '');
                output += `[Salida E/S]: ${expr}\n`;
                impresiones++;
            }
        });

        if (impresiones === 0) {
            output += "Salida del programa: Operación exitosa.\n";
        }

        output += "> Proceso finalizado con código 0.\n";
        return output;
    }
};

if (typeof window !== 'undefined') {
    window.VirtualMachine = VirtualMachine;
}

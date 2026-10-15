/**
 * IDE Indómito - Analizador Sintáctico y Constructor AST (Client-side / WebAssembly Ready)
 * Modulo Sintactico AST Client-side
 */
class Parser {
    constructor(tokens) {
        this.tokens = (tokens || []).filter(t => t.tipo !== 'COM_MULTI' && t.tipo !== 'COM_SIMPLE');
        this.pos = 0;
        this.total = this.tokens.length;
        this.errores = [];
        this.panicMode = false;
    }

    current() {
        return this.pos < this.total ? this.tokens[this.pos] : (this.tokens[this.total - 1] || { tipo: 'EOF', lexema: 'EOF', linea: 1, col: 1 });
    }

    advance() {
        if (this.pos < this.total - 1) {
            this.pos++;
        }
    }

    matchLexema(esperado) {
        const t = this.current();
        if (t.lexema === esperado) {
            this.advance();
            return true;
        }
        this.error(`Se esperaba '${esperado}' pero se encontró '${t.lexema}'`);
        return false;
    }

    error(msg) {
        if (this.panicMode) return;
        this.panicMode = true;
        const t = this.current();
        this.errores.push({
            linea: t.linea || 1,
            col: t.col || 1,
            len: (t.lexema || '').length,
            msg: msg
        });
    }

    synchronize() {
        this.panicMode = false;
        while (this.current().tipo !== 'EOF') {
            if (this.current().lexema === ';') {
                this.advance();
                return;
            }
            switch (this.current().lexema) {
                case 'int': case 'float': case 'bool': case 'real':
                case 'if': case 'while': case 'do': case 'cin': case 'cout':
                case '}': case 'end': case 'else': case 'then':
                    return;
            }
            this.advance();
        }
    }

    parse() {
        if (this.total === 0) {
            return {
                success: true,
                tree: null,
                errores: []
            };
        }
        const ast = this.programa();
        if (this.current().tipo !== 'EOF') {
            this.error("Código inesperado al final del archivo.");
        }
        return {
            success: this.errores.length === 0,
            tree: ast,
            errores: this.errores
        };
    }

    programa() {
        const tMain = this.current();

        if (!this.matchLexema('main')) {
            this.error("El programa debe iniciar con 'main'");
            this.synchronize();
        }

        if (!this.matchLexema('{')) {
            while (this.current().tipo !== 'EOF') {
                if (this.current().lexema === '{' && (this.current().col || 1) === 1) {
                    break;
                }
                this.advance();
            }
            if (this.current().lexema === '{') {
                this.advance();
            } else {
                this.error("Se esperaba '{' después de main");
            }
        }

        const nodos = this.lista_declaracion();

        if (this.current().lexema === '}') {
            this.advance();
        } else {
            this.error("Se esperaba '}' al final del programa");
        }

        return {
            name: 'Programa Principal',
            linea: tMain.linea || 1,
            children: nodos
        };
    }

    lista_declaracion() {
        let nodos = [];
        while (this.current().tipo !== 'EOF' && this.current().lexema !== '}') {
            const nodo = this.declaracion();
            if (nodo) {
                if (Array.isArray(nodo)) {
                    nodos = nodos.concat(nodo);
                } else {
                    nodos.push(nodo);
                }
            }
            if (this.panicMode) {
                this.synchronize();
            }
        }
        return nodos;
    }

    declaracion() {
        const t = this.current();
        if (['int', 'float', 'bool', 'real'].includes(t.lexema)) {
            return this.declaracion_variable();
        } else {
            return this.sentencia();
        }
    }

    declaracion_variable() {
        const t = this.current();
        const tipo = this.tipo();
        const ids = this.identificador();

        if (tipo && ids && ids.length > 0) {
            const nodos = [{ name: 'Tipo: ' + tipo.valor, linea: tipo.linea }];
            for (const id of ids) {
                nodos.push({ name: 'ID: ' + id.valor, linea: id.linea });
            }
            if (!this.matchLexema(';')) this.synchronize();
            return {
                name: 'Declaración Variable',
                linea: t.linea,
                children: nodos
            };
        }
        return null;
    }

    identificador() {
        const ids = [];
        const t = this.current();
        if (this.current().tipo === 'ID') {
            ids.push({ valor: t.lexema, linea: t.linea });
            this.advance();
            while (this.current().lexema === ',') {
                this.advance();
                const t2 = this.current();
                if (this.current().tipo === 'ID') {
                    ids.push({ valor: t2.lexema, linea: t2.linea });
                    this.advance();
                } else {
                    this.error("Se esperaba un identificador después de ','");
                    break;
                }
            }
        } else {
            this.error("Se esperaba un identificador");
        }
        return ids;
    }

    tipo() {
        const t = this.current();
        if (['int', 'float', 'bool', 'real'].includes(t.lexema)) {
            this.advance();
            return { valor: t.lexema, linea: t.linea };
        }
        this.error("Se esperaba un tipo de dato");
        return null;
    }

    isDoWhileTerminator() {
        if (this.current().lexema === 'until') return true;
        if (this.current().lexema !== 'while') return false;
        // Si hay un 'until' pendiente para este do, entonces 'while' es un bucle anidado, no el terminador
        let posAux = this.pos;
        let foundUntil = false;
        let braceDepth = 0;
        while (posAux < this.total) {
            const tok = this.tokens[posAux];
            if (tok.lexema === '{') braceDepth++;
            else if (tok.lexema === '}') braceDepth--;
            if (braceDepth <= 0 && tok.lexema === 'until') {
                foundUntil = true;
                break;
            }
            if (tok.lexema === 'main' || tok.tipo === 'EOF') break;
            posAux++;
        }
        if (foundUntil) return false;

        const saved = this.pos;
        this.advance();
        this.expresion();
        const next = this.current().lexema;
        this.pos = saved;
        return next !== '{';
    }

    lista_sentencias_do_cuerpo() {
        let nodos = [];
        while (this.current().tipo !== 'EOF' && this.current().lexema !== '}' && this.current().lexema !== 'until') {
            if (this.isDoWhileTerminator()) break;
            const nodo = this.sentencia();
            if (nodo) {
                if (Array.isArray(nodo)) {
                    nodos = nodos.concat(nodo);
                } else {
                    nodos.push(nodo);
                }
            }
            if (this.panicMode) {
                this.synchronize();
            }
        }
        return nodos;
    }

    lista_sentencias(extra_stops = []) {
        let nodos = [];
        const stops = ['end', 'else', '}', ...extra_stops];
        while (this.current().tipo !== 'EOF' && !stops.includes(this.current().lexema)) {
            const nodo = this.sentencia();
            if (nodo) {
                if (Array.isArray(nodo)) {
                    nodos = nodos.concat(nodo);
                } else {
                    nodos.push(nodo);
                }
            }
            if (this.panicMode) {
                this.synchronize();
            }
        }
        return nodos;
    }

    sentencia() {
        const t = this.current();
        if (t.lexema === ';') {
            this.advance();
            return null;
        }

        if (t.lexema === '{') {
            this.advance();
            const nodos = this.lista_sentencias();
            if (!this.matchLexema('}')) this.synchronize();
            return { name: 'Llaves', linea: t.linea, children: nodos };
        }

        switch (t.lexema) {
            case 'if': return this.seleccion();
            case 'while': return this.iteracion();
            case 'do': return this.repeticion();
            case 'cin': return this.sent_in();
            case 'cout': return this.sent_in_out('cout');
            case 'int': case 'float': case 'bool': case 'real':
                this.error("Declaración de variable no permitida en este ámbito");
                this.panicMode = false;
                this.declaracion_variable();
                return null;
            default:
                if (t.tipo === 'ID') {
                    return this.asignacion();
                } else if (['+', '-', '*', '/'].includes(t.lexema)) {
                    this.error(`Expresión incompleta. Se encontró '${t.lexema}'`);
                    this.panicMode = false;
                    this.advance();
                    if (this.current().lexema === ';') this.advance();
                    return { name: 'Expresión incompleta: ' + t.lexema, linea: t.linea };
                } else {
                    this.error(`Sentencia inválida. Se encontró '${t.lexema}'`);
                    this.advance();
                    return { name: 'Sentencia inválida: ' + t.lexema, linea: t.linea };
                }
        }
    }

    asignacion() {
        const t = this.current();
        this.advance(); // Consume ID

        if (this.current().lexema === '++' || this.current().lexema === '--') {
            const op = this.current().lexema;
            this.advance();
            if (!this.matchLexema(';')) this.synchronize();
            return {
                name: (op === '++') ? 'Incremento (++)' : 'Decremento (--)',
                linea: t.linea,
                children: [
                    { name: 'Variable: ' + t.lexema, linea: t.linea }
                ]
            };
        }

        if (this.matchLexema('=')) {
            const exp = this.sent_expresion();
            return {
                name: 'Asignación (=)',
                linea: t.linea,
                children: [
                    { name: 'Variable: ' + t.lexema, linea: t.linea },
                    { name: 'Valor', linea: t.linea, children: exp ? [exp] : [] }
                ]
            };
        }

        if (['+', '-', '*', '/'].includes(this.current().lexema)) {
            const op = this.current().lexema;
            this.advance();
            this.error(`Expresión incompleta tras '${t.lexema}${op}'`);
            this.panicMode = false;
            if (this.current().lexema === ';') this.advance();
            return {
                name: 'Expresión incompleta: ' + t.lexema + op,
                linea: t.linea,
                children: [{ name: 'Variable: ' + t.lexema, linea: t.linea }]
            };
        }

        this.error(`Se esperaba '=' o '++' o '--' pero se encontró '${this.current().lexema}'`);
        this.panicMode = false;
        this.synchronize();
        return { name: 'Asignación inválida: ' + t.lexema, linea: t.linea };
    }

    sent_expresion() {
        if (this.current().lexema === ';') {
            this.advance();
            return null;
        }
        const exp = this.expresion();
        if (!this.matchLexema(';')) this.synchronize();
        return exp;
    }

    seleccion() {
        const t = this.current();
        this.advance(); // Consume if
        const exp = this.expresion();
        let cuerpoThen = [];
        let cuerpoElse = [];

        if (!this.matchLexema('then')) {
            this.panicMode = false; // Recuperación inteligente
        }

        cuerpoThen = this.lista_sentencias(['else', 'end']);

        if (this.current().lexema === 'else') {
            this.advance();
            cuerpoElse = this.lista_sentencias(['end']);
        }

        if (!this.matchLexema('end')) {
            this.synchronize();
        }

        const children = [
            { name: 'Condición', linea: t.linea, children: exp ? [exp] : [] },
            { name: 'Bloque THEN', linea: t.linea, children: cuerpoThen }
        ];
        if (cuerpoElse.length > 0) {
            children.push({ name: 'Bloque ELSE', linea: t.linea, children: cuerpoElse });
        }

        return {
            name: 'Sentencia IF',
            linea: t.linea,
            children: children
        };
    }

    iteracion() {
        const t = this.current();
        this.advance(); // Consume while
        const exp = this.expresion();

        let cuerpo = [];
        let hasBrace = false;

        if (this.current().lexema === '{') {
            this.advance();
            hasBrace = true;
            cuerpo = this.lista_sentencias();
        } else {
            cuerpo = this.lista_sentencias(['end']);
        }

        if (hasBrace) {
            if (!this.matchLexema('}')) this.synchronize();
        } else {
            if (this.current().lexema === 'end') {
                this.advance();
            } else if (this.current().lexema === '}') {
                this.advance();
            }
        }

        return {
            name: 'Bucle WHILE',
            linea: t.linea,
            children: [
                { name: 'Condición', linea: t.linea, children: exp ? [exp] : [] },
                { name: 'Cuerpo', linea: t.linea, children: cuerpo }
            ]
        };
    }

    repeticion() {
        const t = this.current();
        this.advance(); // Consume do

        let cuerpo = [];
        let hasBrace = false;
        if (this.current().lexema === '{') {
            this.advance();
            hasBrace = true;
            cuerpo = this.lista_sentencias_do_cuerpo();
        } else {
            cuerpo = this.lista_sentencias_do_cuerpo();
        }

        if (hasBrace) {
            if (this.current().lexema === '}') {
                this.advance();
            } else {
                this.error("Se esperaba '}' antes de until o while");
            }
        } else {
            if (this.current().lexema === '}') {
                this.advance();
            }
        }

        const tTerm = this.current();
        let exp = null;
        let lineaCondicion = t.linea;
        let nombreBucle = 'Bucle DO-WHILE';

        if (this.current().lexema === 'until' || this.current().lexema === 'while') {
            if (this.current().lexema === 'until') nombreBucle = 'Bucle DO-UNTIL';
            this.advance();
            exp = this.expresion();
            lineaCondicion = tTerm.linea;
        } else {
            this.error("Se esperaba 'until' o 'while' al final del do");
            this.synchronize();
        }

        return {
            name: nombreBucle,
            linea: t.linea,
            children: [
                { name: 'Cuerpo', linea: t.linea, children: cuerpo },
                { name: 'Condición', linea: lineaCondicion, children: exp ? [exp] : [] }
            ]
        };
    }

    sent_in() {
        const t = this.current();
        this.advance(); // Consume cin
        const nodos = [];

        if (this.current().lexema === '>>') {
            this.advance();
        } else {
            this.error("Se esperaba '>>' despues de cin");
            this.panicMode = false;
        }

        const t2 = this.current();
        if (t2.tipo === 'ID') {
            nodos.push({ name: 'Destino: ' + t2.lexema, linea: t2.linea });
            this.advance();
        } else {
            if (!this.panicMode) {
                this.error("Se esperaba un identificador");
            }
        }

        if (!this.matchLexema(';')) this.synchronize();

        return {
            name: 'Entrada (cin)',
            linea: t.linea,
            children: nodos
        };
    }

    sent_in_out(type) {
        const t = this.current();
        this.advance(); // Consume cout
        const nodos = [];
        if (this.matchLexema('<<')) {
            nodos.push(this.salida());
            while (this.current().lexema === '<<') {
                this.advance();
                nodos.push(this.salida());
            }
        } else if (['ID', 'CADENA', 'NUM_ENTERO', 'NUM_REAL'].includes(this.current().tipo)) {
            this.error("Se esperaba '<<' despues de cout");
            this.panicMode = false;
            nodos.push(this.salida());
        } else {
            this.error("Se esperaba '<<' despues de cout");
            this.synchronize();
        }
        if (this.current().lexema === ';') {
            this.advance();
        }
        return {
            name: 'Salida (cout)',
            linea: t.linea,
            children: nodos
        };
    }

    salida() {
        const t = this.current();
        if (t.tipo === 'CADENA') {
            this.advance();
            return { name: 'Cadena: ' + t.lexema, linea: t.linea };
        } else {
            return this.expresion();
        }
    }

    // ---------------- PRECEDENCIA Y ASOCIATIVIDAD ----------------

    expresion() {
        return this.exp_or();
    }

    exp_or() {
        let nodo = this.exp_and();
        while (this.current().lexema === '||') {
            const t = this.current();
            this.advance();
            const der = this.exp_and();
            nodo = {
                name: 'Op Lógico (||)',
                linea: t.linea,
                children: [
                    { name: 'Izq', children: nodo ? [nodo] : [] },
                    { name: 'Der', children: der ? [der] : [] }
                ]
            };
        }
        return nodo;
    }

    exp_and() {
        let nodo = this.exp_relacional();
        while (this.current().lexema === '&&') {
            const t = this.current();
            this.advance();
            const der = this.exp_relacional();
            nodo = {
                name: 'Op Lógico (&&)',
                linea: t.linea,
                children: [
                    { name: 'Izq', children: nodo ? [nodo] : [] },
                    { name: 'Der', children: der ? [der] : [] }
                ]
            };
        }
        return nodo;
    }

    exp_relacional() {
        let nodo = this.expresion_simple();
        if (['<', '<=', '>', '>=', '==', '!='].includes(this.current().lexema)) {
            const t = this.current();
            this.advance();
            const der = this.expresion_simple();
            return {
                name: 'Operación Relacional (' + t.lexema + ')',
                linea: t.linea,
                children: [
                    { name: 'Izq', children: nodo ? [nodo] : [] },
                    { name: 'Der', children: der ? [der] : [] }
                ]
            };
        }
        return nodo;
    }

    expresion_simple() {
        let nodo = this.termino();
        while (['+', '-'].includes(this.current().lexema)) {
            const t = this.current();
            this.advance();
            const der = this.termino();
            nodo = {
                name: 'Operación Aditiva (' + t.lexema + ')',
                linea: t.linea,
                children: [
                    { name: 'Izq', children: nodo ? [nodo] : [] },
                    { name: 'Der', children: der ? [der] : [] }
                ]
            };
        }
        return nodo;
    }

    termino() {
        let nodo = this.factor();
        while (['*', '/', '%'].includes(this.current().lexema)) {
            const t = this.current();
            this.advance();
            const der = this.factor();
            nodo = {
                name: 'Operación Multiplicativa (' + t.lexema + ')',
                linea: t.linea,
                children: [
                    { name: 'Izq', children: nodo ? [nodo] : [] },
                    { name: 'Der', children: der ? [der] : [] }
                ]
            };
        }
        return nodo;
    }

    factor() {
        let nodo = this.unaria();
        if (this.current().lexema === '^') {
            const t = this.current();
            this.advance();
            const der = this.factor(); // Llamada recursiva para asociatividad derecha
            nodo = {
                name: 'Potencia (^)',
                linea: t.linea,
                children: [
                    { name: 'Base', children: nodo ? [nodo] : [] },
                    { name: 'Exponente', children: der ? [der] : [] }
                ]
            };
        }
        return nodo;
    }

    unaria() {
        const t = this.current();
        if (['!', '-', '++', '--'].includes(t.lexema)) {
            this.advance();
            const nodo = this.unaria();
            return {
                name: 'Op Unaria (' + t.lexema + ')',
                linea: t.linea,
                children: nodo ? [nodo] : []
            };
        }
        return this.componente();
    }

    componente() {
        const t = this.current();

        if (t.lexema === '(') {
            this.advance();
            const exp = this.expresion();
            if (!this.matchLexema(')')) this.synchronize();
            return {
                name: 'Agrupación ( )',
                linea: t.linea,
                children: exp ? [exp] : []
            };
        } else if (t.tipo === 'NUM_ENTERO' || t.tipo === 'NUM_REAL') {
            this.advance();
            return { name: 'Número: ' + t.lexema, linea: t.linea };
        } else if (['true', 'false'].includes(t.lexema)) {
            this.advance();
            return { name: 'Booleano: ' + t.lexema, linea: t.linea };
        } else if (t.tipo === 'ID') {
            this.advance();
            return { name: 'Identificador: ' + t.lexema, linea: t.linea };
        }

        this.error(`Se esperaba un componente válido. Se encontró '${t.lexema}'`);
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.Parser = Parser;
}

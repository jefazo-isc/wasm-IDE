use serde::{Serialize, Deserialize};
use crate::lexer::Token;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AstNode {
    pub name: String,
    pub linea: usize,
    pub children: Option<Vec<AstNode>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ParserError {
    pub linea: usize,
    pub col: usize,
    pub tipo: String,
    pub lexema: String,
    pub msg: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ParserResult {
    pub success: bool,
    pub tree: Option<AstNode>,
    pub errores: Vec<ParserError>,
}

pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
    total: usize,
    errores: Vec<ParserError>,
    panic_mode: bool,
}

struct TipoIdInfo {
    valor: String,
    linea: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        let filtered: Vec<Token> = tokens
            .into_iter()
            .filter(|t| t.tipo != "COM_MULTI" && t.tipo != "COM_SIMPLE")
            .collect();
        let total = filtered.len();
        Self {
            tokens: filtered,
            pos: 0,
            total,
            errores: Vec::new(),
            panic_mode: false,
        }
    }

    fn current(&self) -> Token {
        if self.pos < self.total {
            let t = &self.tokens[self.pos];
            Token {
                linea: t.linea,
                col: t.col,
                tipo: t.tipo.clone(),
                lexema: t.lexema.clone(),
            }
        } else if self.total > 0 {
            let t = &self.tokens[self.total - 1];
            Token {
                linea: t.linea,
                col: t.col,
                tipo: "EOF".to_string(),
                lexema: "EOF".to_string(),
            }
        } else {
            Token {
                linea: 1,
                col: 1,
                tipo: "EOF".to_string(),
                lexema: "EOF".to_string(),
            }
        }
    }

    fn advance(&mut self) {
        if self.pos < self.total.saturating_sub(1) {
            self.pos += 1;
        }
    }

    fn match_lexema(&mut self, esperado: &str) -> bool {
        let t = self.current();
        if t.lexema == esperado {
            self.advance();
            true
        } else {
            self.error(&format!(
                "Se esperaba '{}' pero se encontró '{}'",
                esperado, t.lexema
            ));
            false
        }
    }

    fn error(&mut self, msg: &str) {
        if self.panic_mode {
            return;
        }
        self.panic_mode = true;
        let t = self.current();
        self.errores.push(ParserError {
            linea: t.linea,
            col: t.col,
            tipo: "ERROR_SINTÁCTICO".to_string(),
            lexema: t.lexema,
            msg: msg.to_string(),
        });
    }

    fn synchronize(&mut self) {
        self.panic_mode = false;
        while self.current().tipo != "EOF" {
            if self.current().lexema == ";" {
                self.advance();
                return;
            }
            match self.current().lexema.as_str() {
                "int" | "float" | "bool" | "real" | "if" | "while" | "do" | "cin" | "cout"
                | "}" | "end" | "else" | "then" => return,
                _ => self.advance(),
            }
        }
    }

    pub fn parse(&mut self) -> ParserResult {
        if self.total == 0 {
            return ParserResult {
                success: true,
                tree: None,
                errores: vec![],
            };
        }
        let ast = self.programa();
        if self.current().tipo != "EOF" {
            self.error("Código inesperado al final del archivo.");
        }
        ParserResult {
            success: self.errores.is_empty(),
            tree: Some(ast),
            errores: self.errores.clone(),
        }
    }

    fn programa(&mut self) -> AstNode {
        let t_main = self.current();

        if !self.match_lexema("main") {
            self.error("El programa debe iniciar con 'main'");
            self.synchronize();
        }

        if !self.match_lexema("{") {
            while self.current().tipo != "EOF" {
                if self.current().lexema == "{" && self.current().col == 1 {
                    break;
                }
                self.advance();
            }
            if self.current().lexema == "{" {
                self.advance();
            } else {
                self.error("Se esperaba '{' después de main");
            }
        }

        let nodos = self.lista_declaracion();

        if self.current().lexema == "}" {
            self.advance();
        } else {
            self.error("Se esperaba '}' al final del programa");
        }

        AstNode {
            name: "Programa Principal".to_string(),
            linea: t_main.linea,
            children: Some(nodos),
        }
    }

    fn lista_declaracion(&mut self) -> Vec<AstNode> {
        let mut nodos = Vec::new();
        while self.current().tipo != "EOF" && self.current().lexema != "}" {
            if let Some(nodo) = self.declaracion() {
                nodos.push(nodo);
            }
            if self.panic_mode {
                self.synchronize();
            }
        }
        nodos
    }

    fn declaracion(&mut self) -> Option<AstNode> {
        let t = self.current();
        match t.lexema.as_str() {
            "int" | "float" | "bool" | "real" => self.declaracion_variable(),
            _ => self.sentencia(),
        }
    }

    fn declaracion_variable(&mut self) -> Option<AstNode> {
        let t = self.current();
        let tipo = self.tipo();
        let ids = self.identificador();

        if let Some(tp) = tipo {
            if !ids.is_empty() {
                let mut nodos = Vec::new();
                nodos.push(AstNode {
                    name: format!("Tipo: {}", tp.valor),
                    linea: tp.linea,
                    children: None,
                });
                for id in ids {
                    nodos.push(AstNode {
                        name: format!("ID: {}", id.valor),
                        linea: id.linea,
                        children: None,
                    });
                }
                if !self.match_lexema(";") {
                    self.synchronize();
                }
                return Some(AstNode {
                    name: "Declaración Variable".to_string(),
                    linea: t.linea,
                    children: Some(nodos),
                });
            }
        }
        None
    }

    fn identificador(&mut self) -> Vec<TipoIdInfo> {
        let mut ids = Vec::new();
        let t = self.current();
        if t.tipo == "ID" {
            ids.push(TipoIdInfo {
                valor: t.lexema,
                linea: t.linea,
            });
            self.advance();
            while self.current().lexema == "," {
                self.advance();
                let t2 = self.current();
                if t2.tipo == "ID" {
                    ids.push(TipoIdInfo {
                        valor: t2.lexema.clone(),
                        linea: t2.linea,
                    });
                    self.advance();
                } else {
                    self.error("Se esperaba un identificador después de ','");
                    break;
                }
            }
        } else {
            self.error("Se esperaba un identificador");
        }
        ids
    }

    fn tipo(&mut self) -> Option<TipoIdInfo> {
        let t = self.current();
        match t.lexema.as_str() {
            "int" | "float" | "bool" | "real" => {
                self.advance();
                Some(TipoIdInfo {
                    valor: t.lexema,
                    linea: t.linea,
                })
            }
            _ => {
                self.error("Se esperaba un tipo de dato");
                None
            }
        }
    }

    fn is_do_while_terminator(&mut self) -> bool {
        if self.current().lexema == "until" {
            return true;
        }
        if self.current().lexema != "while" {
            return false;
        }
        let mut pos_aux = self.pos;
        let mut found_until = false;
        let mut brace_depth = 0;
        while pos_aux < self.total {
            let tok = &self.tokens[pos_aux];
            if tok.lexema == "{" {
                brace_depth += 1;
            } else if tok.lexema == "}" {
                brace_depth -= 1;
            }
            if brace_depth <= 0 && tok.lexema == "until" {
                found_until = true;
                break;
            }
            if tok.lexema == "main" || tok.tipo == "EOF" {
                break;
            }
            pos_aux += 1;
        }
        if found_until {
            return false;
        }

        let saved = self.pos;
        self.advance();
        self.expresion();
        let next = self.current().lexema.clone();
        self.pos = saved;
        next != "{"
    }

    fn lista_sentencias_do_cuerpo(&mut self) -> Vec<AstNode> {
        let mut nodos = Vec::new();
        while self.current().tipo != "EOF" && self.current().lexema != "}" && self.current().lexema != "until" {
            if self.is_do_while_terminator() {
                break;
            }
            if let Some(nodo) = self.sentencia() {
                nodos.push(nodo);
            }
            if self.panic_mode {
                self.synchronize();
            }
        }
        nodos
    }

    fn lista_sentencias(&mut self, extra_stops: &[&str]) -> Vec<AstNode> {
        let mut nodos = Vec::new();
        let mut stops = vec!["end", "else", "}"];
        stops.extend_from_slice(extra_stops);

        while self.current().tipo != "EOF" && !stops.contains(&self.current().lexema.as_str()) {
            if let Some(nodo) = self.sentencia() {
                nodos.push(nodo);
            }
            if self.panic_mode {
                self.synchronize();
            }
        }
        nodos
    }

    fn sentencia(&mut self) -> Option<AstNode> {
        let t = self.current();
        if t.lexema == ";" {
            self.advance();
            return None;
        }

        if t.lexema == "{" {
            self.advance();
            let nodos = self.lista_sentencias(&[]);
            if !self.match_lexema("}") {
                self.synchronize();
            }
            return Some(AstNode {
                name: "Llaves".to_string(),
                linea: t.linea,
                children: Some(nodos),
            });
        }

        match t.lexema.as_str() {
            "if" => return Some(self.seleccion()),
            "while" => return Some(self.iteracion()),
            "do" => return Some(self.repeticion()),
            "cin" => return Some(self.sent_in()),
            "cout" => return Some(self.sent_in_out("cout")),
            "int" | "float" | "bool" | "real" => {
                self.error("Declaración de variable no permitida en este ámbito");
                self.panic_mode = false;
                self.declaracion_variable();
                return None;
            }
            _ => {
                if t.tipo == "ID" {
                    return Some(self.asignacion());
                } else if ["+", "-", "*", "/"].contains(&t.lexema.as_str()) {
                    self.error(&format!("Expresión incompleta. Se encontró '{}'", t.lexema));
                    self.panic_mode = false;
                    self.advance();
                    if self.current().lexema == ";" {
                        self.advance();
                    }
                    return Some(AstNode {
                        name: format!("Expresión incompleta: {}", t.lexema),
                        linea: t.linea,
                        children: None,
                    });
                } else {
                    self.error(&format!("Sentencia inválida. Se encontró '{}'", t.lexema));
                    self.advance();
                    return Some(AstNode {
                        name: format!("Sentencia inválida: {}", t.lexema),
                        linea: t.linea,
                        children: None,
                    });
                }
            }
        }
    }

    fn asignacion(&mut self) -> AstNode {
        let t = self.current();
        self.advance(); // Consumir ID

        let mut is_inc = false;
        let mut is_dec = false;

        // Validar ++ / -- ya sea en un token o en dos separados por culpa del Lexer
        if self.current().lexema == "++" {
            is_inc = true;
            self.advance();
        } else if self.current().lexema == "--" {
            is_dec = true;
            self.advance();
        } else if self.current().lexema == "+" {
            self.advance();
            if self.current().lexema == "+" {
                is_inc = true;
                self.advance();
            } else {
                self.pos -= 1; // Backtrack si solo era un + (ej. asignacion incompleta)
            }
        } else if self.current().lexema == "-" {
            self.advance();
            if self.current().lexema == "-" {
                is_dec = true;
                self.advance();
            } else {
                self.pos -= 1; // Backtrack
            }
        }

        if is_inc || is_dec {
            if !self.match_lexema(";") {
                self.synchronize();
            }
            let name = if is_inc {
                "Incremento (++)".to_string()
            } else {
                "Decremento (--)".to_string()
            };
            return AstNode {
                name,
                linea: t.linea,
                children: Some(vec![AstNode {
                    name: format!("Variable: {}", t.lexema),
                    linea: t.linea,
                    children: None,
                }]),
            };
        }

        if self.match_lexema("=") {
            let exp = self.sent_expresion();
            let mut children = vec![AstNode {
                name: format!("Variable: {}", t.lexema),
                linea: t.linea,
                children: None,
            }];
            let exp_nodes = if let Some(e) = exp { vec![e] } else { vec![] };
            children.push(AstNode {
                name: "Valor".to_string(),
                linea: t.linea,
                children: Some(exp_nodes),
            });
            return AstNode {
                name: "Asignación (=)".to_string(),
                linea: t.linea,
                children: Some(children),
            };
        }

        if ["+", "-", "*", "/"].contains(&self.current().lexema.as_str()) {
            let op = self.current().lexema.clone();
            self.advance();
            self.error(&format!("Expresión incompleta tras '{}{}'", t.lexema, op));
            self.panic_mode = false;
            if self.current().lexema == ";" {
                self.advance();
            }
            return AstNode {
                name: format!("Expresión incompleta: {}{}", t.lexema, op),
                linea: t.linea,
                children: Some(vec![AstNode {
                    name: format!("Variable: {}", t.lexema),
                    linea: t.linea,
                    children: None,
                }]),
            };
        }

        self.error(&format!(
            "Se esperaba '=' o '++' o '--' pero se encontró '{}'",
            self.current().lexema
        ));
        self.panic_mode = false;
        self.synchronize();
        AstNode {
            name: format!("Asignación inválida: {}", t.lexema),
            linea: t.linea,
            children: None,
        }
    }

    fn sent_expresion(&mut self) -> Option<AstNode> {
        if self.current().lexema == ";" {
            self.advance();
            return None;
        }
        let exp = self.expresion();
        if !self.match_lexema(";") {
            self.synchronize();
        }
        exp
    }

    fn seleccion(&mut self) -> AstNode {
        let t = self.current();
        self.advance();
        let exp = self.expresion();

        if !self.match_lexema("then") {
            self.panic_mode = false;
        }

        let cuerpo_then = self.lista_sentencias(&["else", "end"]);
        let mut cuerpo_else = Vec::new();

        if self.current().lexema == "else" {
            self.advance();
            cuerpo_else = self.lista_sentencias(&["end"]);
        }

        if !self.match_lexema("end") {
            self.synchronize();
        }

        let mut children = vec![
            AstNode {
                name: "Condición".to_string(),
                linea: t.linea,
                children: Some(if let Some(e) = exp { vec![e] } else { vec![] }),
            },
            AstNode {
                name: "Bloque THEN".to_string(),
                linea: t.linea,
                children: Some(cuerpo_then),
            },
        ];
        if !cuerpo_else.is_empty() {
            children.push(AstNode {
                name: "Bloque ELSE".to_string(),
                linea: t.linea,
                children: Some(cuerpo_else),
            });
        }

        AstNode {
            name: "Sentencia IF".to_string(),
            linea: t.linea,
            children: Some(children),
        }
    }

    fn iteracion(&mut self) -> AstNode {
        let t = self.current();
        self.advance();
        let exp = self.expresion();

        let mut has_brace = false;
        let cuerpo = if self.current().lexema == "{" {
            self.advance();
            has_brace = true;
            self.lista_sentencias(&[])
        } else {
            self.lista_sentencias(&["end"])
        };

        if has_brace {
            if !self.match_lexema("}") {
                self.synchronize();
            }
        } else {
            if self.current().lexema == "end" {
                self.advance();
            } else if self.current().lexema == "}" {
                self.advance();
            }
        }

        AstNode {
            name: "Bucle WHILE".to_string(),
            linea: t.linea,
            children: Some(vec![
                AstNode {
                    name: "Condición".to_string(),
                    linea: t.linea,
                    children: Some(if let Some(e) = exp { vec![e] } else { vec![] }),
                },
                AstNode {
                    name: "Cuerpo".to_string(),
                    linea: t.linea,
                    children: Some(cuerpo),
                },
            ]),
        }
    }

    fn repeticion(&mut self) -> AstNode {
        let t = self.current();
        self.advance();

        let mut has_brace = false;
        if self.current().lexema == "{" {
            self.advance();
            has_brace = true;
        }
        let cuerpo = self.lista_sentencias_do_cuerpo();

        if has_brace {
            if self.current().lexema == "}" {
                self.advance();
            } else {
                self.error("Se esperaba '}' antes de until o while");
            }
        } else {
            if self.current().lexema == "}" {
                self.advance();
            }
        }

        let t_term = self.current();
        let mut exp = None;
        let mut linea_condicion = t.linea;
        let mut nombre_bucle = "Bucle DO-WHILE".to_string();

        if self.current().lexema == "until" || self.current().lexema == "while" {
            if self.current().lexema == "until" {
                nombre_bucle = "Bucle DO-UNTIL".to_string();
            }
            self.advance();
            exp = self.expresion();
            linea_condicion = t_term.linea;
        } else {
            self.error("Se esperaba 'until' o 'while' al final del do");
            self.synchronize();
        }

        AstNode {
            name: nombre_bucle,
            linea: t.linea,
            children: Some(vec![
                AstNode {
                    name: "Cuerpo".to_string(),
                    linea: t.linea,
                    children: Some(cuerpo),
                },
                AstNode {
                    name: "Condición".to_string(),
                    linea: linea_condicion,
                    children: Some(if let Some(e) = exp { vec![e] } else { vec![] }),
                },
            ]),
        }
    }

    fn sent_in(&mut self) -> AstNode {
        let t = self.current();
        self.advance();
        let mut nodos = Vec::new();

        if self.current().lexema == ">>" {
            self.advance();
        } else {
            self.error("Se esperaba '>>' despues de cin");
            self.panic_mode = false;
        }

        let t2 = self.current();
        if t2.tipo == "ID" {
            nodos.push(AstNode {
                name: format!("Destino: {}", t2.lexema),
                linea: t2.linea,
                children: None,
            });
            self.advance();
        } else {
            if !self.panic_mode {
                self.error("Se esperaba un identificador");
            }
        }

        if !self.match_lexema(";") {
            self.synchronize();
        }

        AstNode {
            name: "Entrada (cin)".to_string(),
            linea: t.linea,
            children: Some(nodos),
        }
    }

    fn sent_in_out(&mut self, _type: &str) -> AstNode {
        let t = self.current();
        self.advance();
        let mut nodos = Vec::new();

        if self.match_lexema("<<") {
            if let Some(s) = self.salida() {
                nodos.push(s);
            }
            while self.current().lexema == "<<" {
                self.advance();
                if let Some(s) = self.salida() {
                    nodos.push(s);
                }
            }
        } else if ["ID", "CADENA", "NUM_ENTERO", "NUM_REAL"].contains(&self.current().tipo.as_str())
        {
            self.error("Se esperaba '<<' despues de cout");
            self.panic_mode = false;
            if let Some(s) = self.salida() {
                nodos.push(s);
            }
        } else {
            self.error("Se esperaba '<<' despues de cout");
            self.synchronize();
        }

        if self.current().lexema == ";" {
            self.advance();
        }

        AstNode {
            name: "Salida (cout)".to_string(),
            linea: t.linea,
            children: Some(nodos),
        }
    }

    fn salida(&mut self) -> Option<AstNode> {
        let t = self.current();
        if t.tipo == "CADENA" {
            self.advance();
            Some(AstNode {
                name: format!("Cadena: {}", t.lexema),
                linea: t.linea,
                children: None,
            })
        } else {
            self.expresion()
        }
    }

    fn expresion(&mut self) -> Option<AstNode> {
        self.exp_or()
    }

    fn exp_or(&mut self) -> Option<AstNode> {
        let mut nodo = self.exp_and();
        while self.current().lexema == "||" {
            let t = self.current();
            self.advance();
            let der = self.exp_and();
            nodo = Some(AstNode {
                name: "Op Lógico (||)".to_string(),
                linea: t.linea,
                children: Some(vec![
                    AstNode {
                        name: "Izq".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
                    },
                    AstNode {
                        name: "Der".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(d) = der { vec![d] } else { vec![] }),
                    },
                ]),
            });
        }
        nodo
    }

    fn exp_and(&mut self) -> Option<AstNode> {
        let mut nodo = self.exp_relacional();
        while self.current().lexema == "&&" {
            let t = self.current();
            self.advance();
            let der = self.exp_relacional();
            nodo = Some(AstNode {
                name: "Op Lógico (&&)".to_string(),
                linea: t.linea,
                children: Some(vec![
                    AstNode {
                        name: "Izq".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
                    },
                    AstNode {
                        name: "Der".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(d) = der { vec![d] } else { vec![] }),
                    },
                ]),
            });
        }
        nodo
    }

    fn exp_relacional(&mut self) -> Option<AstNode> {
        let nodo = self.expresion_simple();
        if ["<", "<=", ">", ">=", "==", "!="].contains(&self.current().lexema.as_str()) {
            let t = self.current();
            self.advance();
            let der = self.expresion_simple();
            return Some(AstNode {
                name: format!("Operación Relacional ({})", t.lexema),
                linea: t.linea,
                children: Some(vec![
                    AstNode {
                        name: "Izq".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
                    },
                    AstNode {
                        name: "Der".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(d) = der { vec![d] } else { vec![] }),
                    },
                ]),
            });
        }
        nodo
    }

    fn expresion_simple(&mut self) -> Option<AstNode> {
        let mut nodo = self.termino();
        while ["+", "-"].contains(&self.current().lexema.as_str()) {
            let t = self.current();
            self.advance();
            let der = self.termino();
            nodo = Some(AstNode {
                name: format!("Operación Aditiva ({})", t.lexema),
                linea: t.linea,
                children: Some(vec![
                    AstNode {
                        name: "Izq".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
                    },
                    AstNode {
                        name: "Der".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(d) = der { vec![d] } else { vec![] }),
                    },
                ]),
            });
        }
        nodo
    }

    fn termino(&mut self) -> Option<AstNode> {
        let mut nodo = self.factor();
        while ["*", "/", "%"].contains(&self.current().lexema.as_str()) {
            let t = self.current();
            self.advance();
            let der = self.factor();
            nodo = Some(AstNode {
                name: format!("Operación Multiplicativa ({})", t.lexema),
                linea: t.linea,
                children: Some(vec![
                    AstNode {
                        name: "Izq".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
                    },
                    AstNode {
                        name: "Der".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(d) = der { vec![d] } else { vec![] }),
                    },
                ]),
            });
        }
        nodo
    }

    fn factor(&mut self) -> Option<AstNode> {
        let mut nodo = self.unaria();
        if self.current().lexema == "^" {
            let t = self.current();
            self.advance();
            let der = self.factor();
            nodo = Some(AstNode {
                name: "Potencia (^)".to_string(),
                linea: t.linea,
                children: Some(vec![
                    AstNode {
                        name: "Base".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
                    },
                    AstNode {
                        name: "Exponente".to_string(),
                        linea: t.linea,
                        children: Some(if let Some(d) = der { vec![d] } else { vec![] }),
                    },
                ]),
            });
        }
        nodo
    }

    fn unaria(&mut self) -> Option<AstNode> {
        let t = self.current();

        let mut is_double_plus = false;
        let mut is_double_minus = false;

        if t.lexema == "+" && self.pos + 1 < self.total && self.tokens[self.pos + 1].lexema == "+" {
            is_double_plus = true;
        } else if t.lexema == "-" && self.pos + 1 < self.total && self.tokens[self.pos + 1].lexema == "-" {
            is_double_minus = true;
        }

        if is_double_plus {
            self.advance(); 
            self.advance(); 
            let nodo = self.unaria();
            return Some(AstNode {
                name: "Op Unaria (++)".to_string(),
                linea: t.linea,
                children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
            });
        } else if is_double_minus {
            self.advance(); 
            self.advance(); 
            let nodo = self.unaria();
            return Some(AstNode {
                name: "Op Unaria (--)".to_string(),
                linea: t.linea,
                children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
            });
        }

        if ["!", "-", "++", "--"].contains(&t.lexema.as_str()) {
            self.advance();
            let nodo = self.unaria();
            return Some(AstNode {
                name: format!("Op Unaria ({})", t.lexema),
                linea: t.linea,
                children: Some(if let Some(n) = nodo { vec![n] } else { vec![] }),
            });
        }
        self.componente()
    }

    fn componente(&mut self) -> Option<AstNode> {
        let t = self.current();

        if t.lexema == "(" {
            self.advance();
            let exp = self.expresion();
            if !self.match_lexema(")") {
                self.synchronize();
            }
            return Some(AstNode {
                name: "Agrupación ( )".to_string(),
                linea: t.linea,
                children: Some(if let Some(e) = exp { vec![e] } else { vec![] }),
            });
        } else if t.tipo == "NUM_ENTERO" || t.tipo == "NUM_REAL" {
            self.advance();
            return Some(AstNode {
                name: format!("Número: {}", t.lexema),
                linea: t.linea,
                children: None,
            });
        } else if t.lexema == "true" || t.lexema == "false" {
            self.advance();
            return Some(AstNode {
                name: format!("Booleano: {}", t.lexema),
                linea: t.linea,
                children: None,
            });
        } else if t.tipo == "ID" {
            self.advance();
            return Some(AstNode {
                name: format!("Identificador: {}", t.lexema),
                linea: t.linea,
                children: None,
            });
        }

        self.error(&format!(
            "Se esperaba un componente válido. Se encontró '{}'",
            t.lexema
        ));
        None
    }
}

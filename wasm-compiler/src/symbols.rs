use serde::{Serialize, Deserialize};
use std::collections::BTreeMap;
use crate::parser::AstNode;
use crate::lexer;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SymbolInfo {
    pub identificador: String,
    pub tipo: String,
    pub lineas: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SymbolsResult {
    pub success: bool,
    pub simbolos: Vec<SymbolInfo>,
}

fn registrar_simbolo(
    simbolos: &mut BTreeMap<String, (String, Vec<usize>)>,
    identificador: &str,
    tipo: &str,
    linea: usize,
) {
    let id_limpio = identificador.trim();
    if id_limpio.is_empty() {
        return;
    }
    let entry = simbolos
        .entry(id_limpio.to_string())
        .or_insert_with(|| (tipo.to_string(), Vec::new()));

    // Si ya existe pero el tipo anterior era genérico o uso y ahora tenemos una declaración concreta, actualizar tipo
    if entry.0.contains("Uso") || entry.0 == "Identificador" {
        if !tipo.contains("Uso") && tipo != "Identificador" {
            entry.0 = tipo.to_string();
        }
    }

    if linea > 0 && !entry.1.contains(&linea) {
        entry.1.push(linea);
    }
}

fn recorrer_ast(nodo: &AstNode, simbolos: &mut BTreeMap<String, (String, Vec<usize>)>) {
    let name = &nodo.name;
    let linea = nodo.linea;

    // 1. Programa principal
    if name.contains("Programa Principal") || name.to_lowercase().contains("main") {
        registrar_simbolo(simbolos, "main", "Punto de Entrada", if linea > 0 { linea } else { 1 });
    }

    // 2. Declaración de variables: Nodo "Declaración Variable" con hijos Tipo e ID
    if name.starts_with("Declaración Variable") {
        if let Some(children) = &nodo.children {
            let mut tipo_var = "Variable".to_string();
            for c in children {
                if c.name.starts_with("Tipo: ") {
                    tipo_var = c.name.replacen("Tipo: ", "", 1).trim().to_string();
                    break;
                }
            }

            for c in children {
                if c.name.starts_with("ID: ") {
                    let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                    let l = if c.linea > 0 { c.linea } else { linea };
                    registrar_simbolo(simbolos, &id, &tipo_var, l);
                }
            }
        }
    }

    // 3. Asignación: Nodo "Asignación" con hijo Variable
    if name.starts_with("Asignación") {
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name.starts_with("Variable: ") {
                    let id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                    let l = if c.linea > 0 { c.linea } else { linea };
                    registrar_simbolo(simbolos, &id, "Asignación/Uso", l);
                }
            }
        }
    }

    // 4. Incremento / Decremento
    if name.starts_with("Incremento") || name.starts_with("Decremento") {
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name.starts_with("Variable: ") {
                    let id = c.name.replacen("Variable: ", "", 1).trim().to_string();
                    let l = if c.linea > 0 { c.linea } else { linea };
                    registrar_simbolo(simbolos, &id, "Incremento/Uso", l);
                }
            }
        }
    }

    // 5. Entrada cin
    if name.starts_with("Sentencia IN") {
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name.starts_with("ID: ") {
                    let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                    let l = if c.linea > 0 { c.linea } else { linea };
                    registrar_simbolo(simbolos, &id, "Entrada (cin)", l);
                }
            }
        }
    }

    // 6. Referencias a Identificadores en expresiones u otros nodos hoja
    if name.starts_with("Identificador: ") {
        let id = name.replacen("Identificador: ", "", 1).trim().to_string();
        registrar_simbolo(simbolos, &id, "Identificador/Uso", linea);
    }

    // Visitar hijos
    if let Some(children) = &nodo.children {
        for child in children {
            recorrer_ast(child, simbolos);
        }
    }
}

pub fn generar_con_ast(codigo: &str, ast_root: Option<&AstNode>) -> SymbolsResult {
    let mut simbolos: BTreeMap<String, (String, Vec<usize>)> = BTreeMap::new();

    if let Some(ast) = ast_root {
        recorrer_ast(ast, &mut simbolos);
    }

    // Si el AST no produjo símbolos o falló, extraer tokens del léxico como fallback
    if simbolos.is_empty() {
        let lex_res = lexer::analizar(codigo);
        for tok in lex_res.tokens {
            if tok.tipo == "ID" {
                registrar_simbolo(&mut simbolos, &tok.lexema, "Identificador", tok.linea);
            } else if tok.tipo == "RESERVADA" && tok.lexema == "main" {
                registrar_simbolo(&mut simbolos, "main", "Punto de Entrada", tok.linea);
            }
        }
    }

    let mut output = Vec::new();
    for (id, (tipo, mut lineas)) in simbolos {
        lineas.sort();
        lineas.dedup();
        let lineas_str = lineas.iter().map(|l| l.to_string()).collect::<Vec<String>>().join(", ");
        output.push(SymbolInfo {
            identificador: id,
            tipo,
            lineas: lineas_str,
        });
    }

    SymbolsResult {
        success: true,
        simbolos: output,
    }
}

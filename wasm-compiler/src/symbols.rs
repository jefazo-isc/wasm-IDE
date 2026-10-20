use serde::{Serialize, Deserialize};
use std::collections::HashMap;
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

#[derive(Clone, Debug)]
struct SymbolRecord {
    tipo: String,
    lineas: Vec<usize>,
}

/// Recorrido en Preorden sobre el AST para recolectar las declaraciones de variables.
fn recolectar_declaraciones_preorden(
    nodo: &AstNode,
    tabla_hash: &mut HashMap<String, SymbolRecord>,
) {
    let name = &nodo.name;

    if name.contains("Programa Principal") || name.to_lowercase().contains("main") {
        tabla_hash.entry("main".to_string()).or_insert_with(|| SymbolRecord {
            tipo: "Punto de Entrada".to_string(),
            lineas: Vec::new(),
        });
    }

    if name.starts_with("Declaración Variable") {
        if let Some(children) = &nodo.children {
            let mut tipo_heredado = "Variable".to_string();
            for c in children {
                if c.name.starts_with("Tipo: ") {
                    tipo_heredado = c.name.replacen("Tipo: ", "", 1).trim().to_string();
                    break;
                }
            }

            for c in children {
                if c.name.starts_with("ID: ") {
                    let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                    if !id.is_empty() {
                        tabla_hash.entry(id).or_insert_with(|| SymbolRecord {
                            tipo: tipo_heredado.clone(),
                            lineas: Vec::new(),
                        });
                    }
                }
            }
        }
    }

    if let Some(children) = &nodo.children {
        for child in children {
            recolectar_declaraciones_preorden(child, tabla_hash);
        }
    }
}

pub fn generar_con_ast(codigo: &str, ast_root: Option<&AstNode>) -> SymbolsResult {
    let mut tabla_hash: HashMap<String, SymbolRecord> = HashMap::new();

    if let Some(ast) = ast_root {
        recolectar_declaraciones_preorden(ast, &mut tabla_hash);
    }

    // Análisis léxico para conteo completo de apariciones
    let lex_res = lexer::analizar(codigo);
    let tokens = &lex_res.tokens;

    if tabla_hash.is_empty() {
        let mut idx = 0;
        while idx < tokens.len() {
            let tok = &tokens[idx];
            if tok.tipo == "RESERVADA" && ["int", "float", "bool", "real"].contains(&tok.lexema.as_str()) {
                let tipo = tok.lexema.clone();
                idx += 1;
                while idx < tokens.len() {
                    let next = &tokens[idx];
                    if next.tipo == "ID" {
                        tabla_hash.entry(next.lexema.clone()).or_insert_with(|| SymbolRecord {
                            tipo: tipo.clone(),
                            lineas: Vec::new(),
                        });
                    } else if next.lexema == ";" {
                        break;
                    }
                    idx += 1;
                }
            } else if tok.tipo == "RESERVADA" && tok.lexema == "main" {
                tabla_hash.entry("main".to_string()).or_insert_with(|| SymbolRecord {
                    tipo: "Punto de Entrada".to_string(),
                    lineas: vec![tok.linea],
                });
            }
            idx += 1;
        }
    }

    // Registrar TODAS las apariciones de cada ID declarado (incluyendo números duplicados)
    for tok in tokens {
        if tok.tipo == "ID" {
            if let Some(rec) = tabla_hash.get_mut(&tok.lexema) {
                rec.lineas.push(tok.linea);
            }
        } else if tok.tipo == "RESERVADA" && tok.lexema == "main" {
            if let Some(rec) = tabla_hash.get_mut("main") {
                rec.lineas.push(tok.linea);
            }
        }
    }

    let mut lista_salida = Vec::new();
    let mut ids_ordenados: Vec<String> = tabla_hash.keys().cloned().collect();
    ids_ordenados.sort();

    for id in ids_ordenados {
        if let Some(mut record) = tabla_hash.remove(&id) {
            record.lineas.sort();
            let lineas_str = record.lineas.iter().map(|l| l.to_string()).collect::<Vec<String>>().join(", ");
            lista_salida.push(SymbolInfo {
                identificador: id,
                tipo: record.tipo,
                lineas: lineas_str,
            });
        }
    }

    SymbolsResult {
        success: true,
        simbolos: lista_salida,
    }
}

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

/// Fase 1: Recorrido en Preorden sobre el AST para construir la memoria contextual
/// utilizando atributos heredados (el tipo de dato se propaga hacia los identificadores).
fn recolectar_declaraciones_preorden(
    nodo: &AstNode,
    tabla_hash: &mut HashMap<String, SymbolRecord>,
) {
    let name = &nodo.name;
    let linea = nodo.linea;

    // Registrar punto de entrada principal
    if name.contains("Programa Principal") || name.to_lowercase().contains("main") {
        let l = if linea > 0 { linea } else { 1 };
        tabla_hash.insert(
            "main".to_string(),
            SymbolRecord {
                tipo: "Punto de Entrada".to_string(),
                lineas: vec![l],
            },
        );
    }

    // Declaración de variables: Nodo "Declaración Variable" con atributo heredado de Tipo
    if name.starts_with("Declaración Variable") {
        if let Some(children) = &nodo.children {
            let mut tipo_heredado = "Variable".to_string();
            for c in children {
                if c.name.starts_with("Tipo: ") {
                    tipo_heredado = c.name.replacen("Tipo: ", "", 1).trim().to_string();
                    break;
                }
            }

            // Propagar tipo heredado a los identificadores declarados
            for c in children {
                if c.name.starts_with("ID: ") {
                    let id = c.name.replacen("ID: ", "", 1).trim().to_string();
                    let l = if c.linea > 0 { c.linea } else { linea };
                    if !id.is_empty() {
                        let record = tabla_hash.entry(id).or_insert_with(|| SymbolRecord {
                            tipo: tipo_heredado.clone(),
                            lineas: Vec::new(),
                        });
                        if l > 0 && !record.lineas.contains(&l) {
                            record.lineas.push(l);
                        }
                    }
                }
            }
        }
    }

    // Continuar recorrido en Preorden sobre los hijos
    if let Some(children) = &nodo.children {
        for child in children {
            recolectar_declaraciones_preorden(child, tabla_hash);
        }
    }
}

/// Registro de referencias de uso: Solo para variables PREVIAMENTE DECLARADAS en la Tabla Hash.
/// Regla Estricta (Diferencia con TINY): Rechazar inserción de variables sin declaración previa.
fn registrar_usos(
    nodo: &AstNode,
    tabla_hash: &mut HashMap<String, SymbolRecord>,
) {
    let name = &nodo.name;
    let linea = nodo.linea;

    let mut intentar_registrar_uso = |id: &str, l: usize| {
        let id_limpio = id.trim();
        if id_limpio.is_empty() || id_limpio == "true" || id_limpio == "false" {
            return;
        }
        // Solo registrar si fue previamente declarada en la tabla hash
        if let Some(record) = tabla_hash.get_mut(id_limpio) {
            if l > 0 && !record.lineas.contains(&l) {
                record.lineas.push(l);
            }
        }
    };

    if name.starts_with("Asignación") {
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name.starts_with("Variable: ") {
                    let id = c.name.replacen("Variable: ", "", 1);
                    let l = if c.linea > 0 { c.linea } else { linea };
                    intentar_registrar_uso(&id, l);
                }
            }
        }
    } else if name.starts_with("Incremento") || name.starts_with("Decremento") {
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name.starts_with("Variable: ") {
                    let id = c.name.replacen("Variable: ", "", 1);
                    let l = if c.linea > 0 { c.linea } else { linea };
                    intentar_registrar_uso(&id, l);
                }
            }
        }
    } else if name.starts_with("Sentencia IN") {
        if let Some(children) = &nodo.children {
            for c in children {
                if c.name.starts_with("ID: ") {
                    let id = c.name.replacen("ID: ", "", 1);
                    let l = if c.linea > 0 { c.linea } else { linea };
                    intentar_registrar_uso(&id, l);
                }
            }
        }
    } else if name.starts_with("Identificador: ") {
        let id = name.replacen("Identificador: ", "", 1);
        intentar_registrar_uso(&id, linea);
    }

    if let Some(children) = &nodo.children {
        for child in children {
            registrar_usos(child, tabla_hash);
        }
    }
}

pub fn generar_con_ast(codigo: &str, ast_root: Option<&AstNode>) -> SymbolsResult {
    // Estructura en Tabla Hash (HashMap) para almacenar y gestionar los identificadores
    let mut tabla_hash: HashMap<String, SymbolRecord> = HashMap::new();

    if let Some(ast) = ast_root {
        // 1. Preorden para construcción de memoria contextual y atributos heredados
        recolectar_declaraciones_preorden(ast, &mut tabla_hash);
        // 2. Registro de líneas de uso bajo la regla estricta (no insertar no declarados)
        registrar_usos(ast, &mut tabla_hash);
    }

    // Fallback únicamente si el código es plano o falla sintácticamente
    if tabla_hash.is_empty() {
        let lex_res = lexer::analizar(codigo);
        // Identificar declaraciones si existen en tokens
        let mut idx = 0;
        let tokens = &lex_res.tokens;
        while idx < tokens.len() {
            let tok = &tokens[idx];
            if tok.tipo == "RESERVADA" && ["int", "float", "bool", "real"].contains(&tok.lexema.as_str()) {
                let tipo = tok.lexema.clone();
                idx += 1;
                while idx < tokens.len() {
                    let next = &tokens[idx];
                    if next.tipo == "ID" {
                        let rec = tabla_hash.entry(next.lexema.clone()).or_insert_with(|| SymbolRecord {
                            tipo: tipo.clone(),
                            lineas: Vec::new(),
                        });
                        rec.lineas.push(next.linea);
                    } else if next.lexema == ";" {
                        break;
                    }
                    idx += 1;
                }
            } else if tok.tipo == "RESERVADA" && tok.lexema == "main" {
                tabla_hash.insert("main".to_string(), SymbolRecord {
                    tipo: "Punto de Entrada".to_string(),
                    lineas: vec![tok.linea],
                });
            }
            idx += 1;
        }
    }

    let mut lista_salida = Vec::new();
    let mut ids_ordenados: Vec<String> = tabla_hash.keys().cloned().collect();
    ids_ordenados.sort();

    for id in ids_ordenados {
        if let Some(mut record) = tabla_hash.remove(&id) {
            record.lineas.sort();
            record.lineas.dedup();
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

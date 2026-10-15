use serde::{Serialize, Deserialize};
use regex::Regex;
use lazy_static::lazy_static;

#[derive(Serialize, Deserialize, Debug)]
pub struct Token {
    pub linea: usize,
    pub col: usize,
    pub tipo: String,
    pub lexema: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LexError {
    pub linea: usize,
    pub col: usize,
    pub tipo: String,
    pub lexema: String,
    pub msg: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LexerResult {
    pub success: bool,
    pub tokens: Vec<Token>,
    pub errores: Vec<LexError>,
}

lazy_static! {
    static ref PATRONES: Vec<(&'static str, Regex)> = vec![
        ("COM_MULTI", Regex::new(r"(?s)^\/\*.*?\*\/").unwrap()),
        ("COM_SIMPLE", Regex::new(r"^\/\/[^\n]*").unwrap()),
        ("RESERVADA", Regex::new(r"^(if|else|end|do|while|switch|case|int|float|bool|main|cin|cout|real|then|until|true|false)\b").unwrap()),
        ("ID", Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*").unwrap()),
        ("NUM_REAL", Regex::new(r"^[0-9]+\.[0-9]+").unwrap()),
        ("ERR_NUM", Regex::new(r"^[0-9]+\.").unwrap()), // Replaces ^[0-9]+\.(?![0-9]) since NUM_REAL is checked first
        ("NUM_ENTERO", Regex::new(r"^[0-9]+").unwrap()),
        ("OP_RELACIONAL", Regex::new(r"^(<\s*<|>\s*>|<\s*=|>\s*=|!\s*=|=\s*=|<|>)").unwrap()),
        ("OP_LOGICO", Regex::new(r"^(&\s*&|\|\s*\||!)").unwrap()),
        ("OP_ARITMETICO", Regex::new(r"^(\+[ \t]*\+|-[ \t]*-|\+|-|\*|\/|%|\^)").unwrap()),
        ("ASIGNACION", Regex::new(r"^=").unwrap()),
        ("CADENA", Regex::new(r#"^"[^"]*""#).unwrap()),
        ("CARACTER", Regex::new(r"^'[^']*'").unwrap()),
        ("SIMBOLO", Regex::new(r#"^(\(|\)|\[|\]|\{|\}|,|;|"|'|\.|#|:)"#).unwrap()),
    ];
    static ref ESPACIOS: Regex = Regex::new(r"^(\s+)").unwrap();
}

pub fn analizar(codigo: &str) -> LexerResult {
    let mut tokens = Vec::new();
    let mut errores = Vec::new();
    
    let mut offset = 0;
    let mut linea_actual = 1;
    let mut col_actual = 1;
    let longitud = codigo.len();

    while offset < longitud {
        let subcadena = &codigo[offset..];
        let mut matched = false;

        // Soporte para espacios y saltos de línea
        if let Some(captures) = ESPACIOS.captures(subcadena) {
            let espacios = captures.get(1).unwrap().as_str();
            let saltos = espacios.matches('\n').count();
            
            if saltos > 0 {
                linea_actual += saltos;
                let ultimo_salto = espacios.rfind('\n').unwrap();
                let texto_despues = &espacios[ultimo_salto + 1..];
                col_actual = texto_despues.chars().count() + 1;
            } else {
                col_actual += espacios.chars().count();
            }
            offset += espacios.len();
            continue;
        }

        for (tipo, regex) in PATRONES.iter() {
            if let Some(mat) = regex.find(subcadena) {
                let lexema_original = mat.as_str();
                let mut lexema_mostrar = lexema_original.to_string();

                if *tipo == "OP_RELACIONAL" || *tipo == "OP_LOGICO" || *tipo == "OP_ARITMETICO" {
                    lexema_mostrar = lexema_original.replace(char::is_whitespace, "");
                }

                if *tipo == "ERR_NUM" {
                    errores.push(LexError {
                        linea: linea_actual,
                        col: col_actual,
                        tipo: "ERROR_LÉXICO".to_string(),
                        lexema: lexema_mostrar,
                        msg: "Número malformado".to_string(),
                    });
                } else if *tipo != "COM_MULTI" && *tipo != "COM_SIMPLE" {
                    tokens.push(Token {
                        linea: linea_actual,
                        col: col_actual,
                        tipo: tipo.to_string(),
                        lexema: lexema_mostrar,
                    });
                }

                let saltos_lex = lexema_original.matches('\n').count();
                if saltos_lex > 0 {
                    linea_actual += saltos_lex;
                    let ultimo_salto_lex = lexema_original.rfind('\n').unwrap();
                    let texto_despues_lex = &lexema_original[ultimo_salto_lex + 1..];
                    col_actual = texto_despues_lex.chars().count() + 1;
                } else {
                    col_actual += lexema_original.chars().count();
                }

                offset += lexema_original.len();
                matched = true;
                break;
            }
        }

        if !matched && offset < longitud {
            let subcadena = &codigo[offset..];
            let char_error = subcadena.chars().next().unwrap();
            errores.push(LexError {
                linea: linea_actual,
                col: col_actual,
                tipo: "ERROR_LÉXICO".to_string(),
                lexema: char_error.to_string(),
                msg: "Carácter inválido no reconocido".to_string(),
            });
            col_actual += 1;
            offset += char_error.len_utf8();
        }
    }

    tokens.push(Token {
        linea: linea_actual,
        col: col_actual,
        tipo: "EOF".to_string(),
        lexema: "EOF".to_string(),
    });

    LexerResult {
        success: true,
        tokens,
        errores,
    }
}

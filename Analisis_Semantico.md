Análisis Semántico y Tabla de
Símbolos en el Compilador
TINY
Autor: Yahir Guevara Cardona
Materia: Compiladores II
Docente: Dra. Blanca Guadalupe Estrada Renteria

Fase 1: Introducción y Propósito
Propósito Principal

Enfoque de la Presentación

Comprender la implementación del análisis semántico en el compilador TINY,

Explicaremos la función de cada componente dentro del flujo de análisis semántico,

analizando la construcción de su tabla de símbolos, el proceso de verificación de

justificando por qué y cómo operan sobre el árbol sintáctico.

tipos.

Índice
01

02

03

Estructura general del
analizador semántico

Construcción de la tabla de
símbolos

Inferencia y verificación de
tipos

04

05

06

Reglas semánticas y detección
de errores

Ejemplo práctico y comparativa
con el proyecto

Conclusiones

Fase 2: Estructura General del Analizador
Semántico
El análisis semántico requiere del Árbol Sintáctico (generado por el analizador sintáctico) como estructura base para operar.

Procesos Principales (analyze.h)
El análisis se divide en dos fases que ejecutan recorridos distintos sobre el árbol:

buildSymtab(TreeNode *)

typeCheck(TreeNode *)

Construye la tabla de símbolos.

Realiza la verificación e inferencia de tipos.

Fase 2: El Flujo General del Análisis Semántico
El análisis semántico sigue un flujo de transformación del árbol sintáctico a través de dos recorridos principales:

1. Árbol sintáctico

2. Tabla de símbolos

(entrada del analizador sintáctico)

(construida en preorden)

3. Verificación de tipos

4. Árbol anotado

(realizada en postorden)

(salida con información de tipos)

Recorridos y Atributos
Recorrido

Tipo de Atributo

Descripción y Uso en TINY

Preorden (Padre → Hijos)

Heredados

↓ Usado por buildSymtab para propagar el contexto y construir
la tabla de símbolos mientras se desciende por el árbol.

Postorden (Hijos → Padre)

Sintetizados

↑ Usado por typeCheck, ya que un nodo padre necesita conocer
los tipos de sus hijos antes de poder inferir o verificar su propio
tipo.

Fase 3: Construcción de la Tabla de Símbolos
Análisis de buildSymtab() y traverse()
La función buildSymtab() inicia el proceso llamando a traverse(syntaxTree, insertNode, nullProc).
traverse() es un procedimiento genérico que recorre el árbol. Al pasar insertNode como función de pre-visita (preorden) y nullProc como
post-visita, aseguramos que la tabla se construya de arriba hacia abajo.
La función insertNode() evalúa cada nodo. Solo actúa si el nodo representa una variable: AssignK, ReadK, e IdK.

Inserción y Búsqueda (st_insert y st_lookup)
Para cada identificador encontrado, se utiliza st_lookup() para verificar si ya existe en la tabla.
Si no existe, st_insert() lo agrega. La variable global location se incrementa para asignar una localidad de memoria única a este nuevo
identificador.
Nota crucial sobre TINY: Como cualquier identificador nuevo se inserta automáticamente en la tabla al ser encontrado, la versión actual
de TINY no genera errores de "variable no declarada".

Implementación de la Tabla Hash (symtab.h /
symtab.c)
La tabla de símbolos se implementa como una tabla hash con encadenamiento separado para resolver colisiones.

Función Hash
Calcula un índice numérico a partir del nombre del identificador.

Tamaño Fijo
La tabla es un arreglo de tamaño estático definido por SIZE.

BucketList
Representa los nodos de la tabla. Almacena el nombre, la localidad asignada y un puntero a una LineList.

Detalles de la Implementación de la Tabla Hash
Continuando con la implementación de la tabla hash en TINY, profundizamos en sus componentes y su comportamiento.

LineList

Gestión de Colisiones

Una lista enlazada que almacena todos los números de línea

Si dos variables distintas producen el mismo índice hash, se

del código fuente donde el identificador es referenciado.

enlazan en la misma posición de la tabla (encadenamiento).

Comportamiento
Un identificador se registra como BucketList una sola vez, pero su LineList crece con cada nueva referencia, que luego es mostrada por
printSymTab().

Fase 4: Inferencia y Verificación de Tipos
Análisis de typeCheck()
Utiliza un recorrido en postorden llamando a: traverse(syntaxTree, nullProc, checkNode).
¿Por qué Postorden? Para inferir el tipo de una expresión (ej. una suma), necesitamos conocer primero el tipo de sus operandos (los
hijos). Esto se relaciona directamente con el cálculo de atributos sintetizados.

Fase 4: Tipos Soportados en TINY
TINY soporta tres tipos fundamentales evaluados por checkNode(): Void, Integer, y Boolean.

ConstK (Constantes numéricas)

IdK (Identificadores)

Integer

Integer (En TINY, todas las variables son enteras)

Operaciones aritméticas (+, -, *, /)

Operaciones lógicas/relacionales (<, =)

Integer (Requiere que ambos hijos sean Integer)

Boolean (Requiere que ambos hijos sean Integer)

Fase 5: Reglas Semánticas y Errores Detectados por
TINY
La función checkNode() implementa validaciones estrictas y reporta errores usando TypeError() bajo el formato: "Type error at line X:

[mensaje]".
Mensaje de Error

Regla Semántica Violada

Causa / Parte del Árbol Consultada

Op applied to non-integer

Los operandos de operaciones

El nodo padre verifica los tipos sintetizados

aritméticas/relacionales deben ser enteros.

de sus hijos izquierdo y derecho. Uno o
ambos no son Integer.

if test is not Boolean

La condición de una sentencia if debe

En un nodo IfK, se verifica el tipo del hijo que

evaluar a un valor de verdad.

representa la condición. Se esperaba
Boolean.

repeat test is not Boolean

La condición de un ciclo repeat-until debe

En un nodo RepeatK, se verifica el hijo de la

evaluar a un valor de verdad.

condición. Se esperaba Boolean.

Fase 5: Errores de Asignación y Escritura
assignment of non-integer value

write of non-integer value

Solo se pueden asignar valores enteros a variables. En un

La instrucción write solo imprime enteros. En un nodo

nodo AssignK, se verifica el tipo de la expresión a asignar. No

WriteK, la expresión hija no sintetiza a Integer.

es Integer.

Nota: Como se mencionó, TINY no valida "variable no declarada".

Fase 6: Demostración del IDE en WebAssembly
Breve demostración del IDE en ejecución sobre WebAssembly, mostrando cómo se analiza un ejemplo sencillo de TINY en tiempo real.
read x;
if x < 10 then
x := x + 1
end

Análisis Léxico: mi IDE (Rust/WASM) vs TINY (C)
Mi IDE (Rust/WASM)

TINY (C)

Tabla de regex para reconocer tokens con línea y columna:

DFA manual en scan.c para recorrer caracteres y cambiar de
estado:

("RESERVADA",
Regex::new(r"^(if|else|while|int|float|bool|...)")),

case START:

("ID",

if (isdigit(c))

Regex::new(r"^[a-zA-Z_][a-zA-Z0-9_]*")),

("NUM_REAL", Regex::new(r"^[0-9]+\.[0-9]+"))

state = INNUM;

else if (isalpha(c)) state = INID;
else if (c == '{') state = INCOMMENT;

Mi IDE: tabla de regex, con línea y columna. TINY: DFA a mano.

Portado de PHP a WebAssembly
Todo corre en el navegador, sin servidor.

Ventajas
Ejecución instantánea sin latencia de red

Privacidad: el código se procesa localmente

Accesibilidad: funciona en cualquier
navegador moderno

Rendimiento: compilación y análisis en tiempo
real

Demo en Vivo
Programa en el lenguaje de mi IDE:
main {
int x, y;
x = 5;
y = 10;
x = x + y;
y++;
cout << x;
}

Código Intermedio: mi IDE vs TINY
Mi IDE, intermediate.rs — 3 direcciones
let temp = format!("t{}", contador_temp);

TINY, cgen.c — TM desde el AST
case IfK:
cGen(tree->child[0]); /* genera la condición */

// x = x + y

emitRM("JZERO", ...); /* emite el salto */

// t1 = x + y
// x = t1

Mi IDE: 3 direcciones vía regex; pendiente: AST y saltos. TINY: genera TM final recorriendo el árbol.

Análisis Sintáctico: mi IDE vs TINY
Mi IDE, parser.rs — descendente recursivo:

TINY, parse.y — gramática para Yacc, LALR:

match t.lexema.as_str() {

stmt : IF exp THEN stmt_seq END

"if" => self.seleccion(),

| REPEAT stmt_seq UNTIL exp

"while" => self.iteracion(),

| identifier ":=" exp

"do" => self.repeticion(),

| READ identifier

_

| WRITE exp ;

=> self.asignacion(),

}

Mi IDE: descendente recursivo + panic mode. TINY: Yacc LALR(1), se detiene en el primer error.

Fase 6: Ejemplo Práctico (Violación Semántica)
Código:
read x;
if x then
x := x + (1 < 2)
end

Explicación:
Error en línea 2: Genera: Type error at line 2: if test is not Boolean.
Error en línea 3: Genera: Op applied to non-integer.

Comparativa: TINY vs Proyecto (Wasm-IDE)
TINY
TINY usa una Tabla Hash básica y recorridos sobre el AST.
Diferencias: TINY asume que todo es Integer o Boolean y no exige
declarar variables.

Proyecto (Wasm-IDE)
En nuestro proyecto (Wasm-IDE) debemos reescribir
insertNode para rechazar variables sin declaración previa y
expandir las reglas para soportar múltiples tipos de datos.

Conclusiones
El AST es la estructura fundamental.

El recorrido Preorden construye la memoria

El recorrido Postorden valida las reglas

contextual (Tabla de símbolos) usando

rigurosamente usando atributos sintetizados.

atributos heredados.

TINY es un esqueleto algorítmico que debemos expandir.


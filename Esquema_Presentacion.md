Esquema de Presentación
Análisis Semántico y Tabla de Símbolos en el Compilador TINY
Materia: Compiladores II
Guía para la preparación de la presentación por equipos

Propósito de la presentación
Comprender cómo se realiza el análisis semántico en el compilador TINY, identificar el funcionamiento de su tabla de
símbolos y de la verificación de tipos, y reconocer las diferencias entre la semántica de TINY y la del lenguaje que se
está desarrollando en el proyecto del curso.

Indicaciones generales
•
•
•

La presentación se organizará por fases. Cada equipo podrá utilizar una o varias diapositivas para desarrollar cada
fase, según lo requiera la explicación.
El objetivo no es únicamente mostrar fragmentos de código, sino explicar qué hace cada componente, por qué se
utiliza y cómo participa dentro del análisis semántico.
Cuando se muestre código, deberá explicarse su relación con el árbol sintáctico, la tabla de símbolos, los atributos y
las reglas semánticas del lenguaje TINY.

Fase 1 – Presentación del equipo y propósito
•
•
•
•
•
•

Título: Análisis Semántico y Tabla de Símbolos en el Compilador TINY.
Nombre de los integrantes del equipo.
Materia: Compiladores II.
Docente.
Índice.
Introducción: Explicar brevemente el propósito de la presentación.

Fase 2 – Estructura general del analizador semántico
•
•
•
•
•

Explicar que el análisis semántico parte del árbol sintáctico generado por el analizador sintáctico.
Presentar los dos procesos principales definidos en analyze.h: buildSymtab(TreeNode *) y typeCheck(TreeNode *).
Mostrar el flujo general: Árbol sintáctico → Construcción de la tabla de símbolos → Verificación e inferencia de tipos
→ Árbol con anotaciones semánticas.
Explicar la diferencia entre recorrido preorden y recorrido postorden.
Relacionar estos recorridos con los conceptos de atributos heredados y atributos sintetizados.

Fase 3 – Construcción de la tabla de símbolos e Implementación de la tabla de símbolos
•
•
•
•
•
•
•
•
•
•
•
•
•
•
•

Analizar la función buildSymtab() y la llamada traverse(syntaxTree, insertNode, nullProc).
Explicar el funcionamiento general de traverse.
Explicar la función insertNode.
Identificar los nodos donde aparecen variables: AssignK, ReadK e IdK.
Explicar el uso de st_lookup y st_insert.
Explicar el uso de la variable location para asignar una localidad a cada identificador nuevo.
Aclarar que, en TINY, cuando aparece por primera vez un identificador, éste se incorpora a la tabla de símbolos; por
ello esta implementación no genera un error de “variable no declarada”.
Analizar los archivos symtab.h y symtab.c.
Explicar que la estructura utilizada es una tabla hash con encadenamiento separado.
Explicar la función hash y el tamaño de la tabla.
Explicar las estructuras BucketList y LineList.
Explicar cómo se resuelven las colisiones.
Mostrar cómo se almacena el nombre del identificador, la localidad de memoria y los números de línea donde
aparece.
Analizar las funciones st_insert(), st_lookup() y printSymTab().
Mostrar mediante un ejemplo cómo una variable se registra una sola vez, pero puede acumular varias líneas de
referencia.

Compiladores II | Dra. Blanca Guadalupe Estrada Renteria | Análisis Semántico TINY | 1

Fase 4 – Inferencia y verificación de tipos
•
•
•
•
•

Analizar la función typeCheck() y explicar por qué utiliza un recorrido postorden: traverse(syntaxTree, nullProc,
checkNode).
Analizar detalladamente la función checkNode().
Explicar los tipos utilizados por el analizador: Void, Integer y Boolean.
Mostrar cómo se determina el tipo de cada clase de expresión: ConstK → Integer; IdK → Integer; operaciones
aritméticas → Integer; operaciones < y = → Boolean.
Explicar por qué los tipos de los hijos deben conocerse antes de calcular o verificar el tipo del nodo padre y
relacionarlo con el concepto de atributo sintetizado.

Fase 5 – Reglas semánticas y errores que detecta TINY
•
•
•
•
•

Identificar las verificaciones que realmente están implementadas en checkNode().
Explicar los errores: Op applied to non-integer; if test is not Boolean; assignment of non-integer value; write of noninteger value; repeat test is not Boolean.
Para cada error, indicar qué regla semántica se verifica, qué parte del árbol se consulta, qué tipo se esperaba y qué
situación provoca el error.
Explicar la función typeError() y el formato del mensaje: Type error at line X: mensaje.
No presentar “variable no declarada” como un error del compilador TINY, ya que la versión analizada no realiza esta
validación.

Fase 6 – Ejemplo práctico completo y TINY frente al lenguaje del proyecto de Compiladores II
•
•
•
•
•
•
•

Seleccionar un pequeño programa escrito en TINY y explicar su procesamiento semántico completo.
Mostrar: Código TINY → Árbol sintáctico → Tabla de símbolos → Tipos anotados en el árbol → Resultado del
análisis semántico.
Incluir los identificadores encontrados, las localidades asignadas y las líneas donde aparece cada identificador.
Mostrar los tipos obtenidos para las expresiones y las verificaciones realizadas.
Incluir al menos un ejemplo semánticamente incorrecto y explicar dónde se produce el error, qué regla semántica se
viola y qué mensaje genera typeError().
Comparar el comportamiento semántico de TINY con la gramática y el lenguaje que cada equipo está
implementando en su proyecto.
Explicar qué partes del analizador semántico de TINY pueden servir como modelo para su compilador y cuáles
deberán modificarse o ampliarse.

Fase 7 – Conclusiones
•
•
•
•
•
•
•

Función del análisis semántico dentro del compilador.
Importancia del árbol sintáctico como entrada para esta fase.
Papel de la tabla de símbolos.
Relación entre recorrido preorden y construcción de la tabla.
Relación entre recorrido postorden e inferencia/verificación de tipos.
Principales limitaciones de la semántica de TINY.
Elementos que deberán incorporar o modificar para implementar la semántica del compilador desarrollado en el
proyecto.

Idea central que debe quedar clara en la presentación
TINY es un modelo didáctico para comprender cómo se implementa un analizador semántico. El objetivo no es
copiar su implementación, sino comprender su funcionamiento para posteriormente adaptarlo y extenderlo de
acuerdo con la gramática y las reglas semánticas del lenguaje desarrollado en el proyecto de Compiladores II.

Compiladores II | Dra. Blanca Guadalupe Estrada Renteria | Análisis Semántico TINY | 2


Apuntes de Generación de Código
Introducción
En este capítulo volveremos a la tarea final de un compilador, la de generar código
ejecutable para una máquina objetivo que sea una fiel representación de la semántica del
código fuente. La generación de código es la fase más compleja de un compilador, puesto
que no sólo depende de las características del lenguaje fuente sino también de contar con
información detallada acerca de la arquitectura objetivo, la estructura del ambiente de
ejecución y el sistema operativo que esté corriendo en la máquina objetivo. La generación
de código por lo regular implica también algún intento por optimizar, o mejorar, la
velocidad y/o el tamaño del código objetivo recolectando más información acerca del
programa fuente y adecuando el código generado para sacar ventaja de las características
especiales de la máquina objetivo, tales como registros, modos de direccionamiento,
distribución y memoria caché.
Debido a la complejidad de la generación del código, un compilador por lo regular divide
esta fase en varios pasos, los cuales involucran varias estructuras de datos intermedias, y a
menudo incluyen alguna forma de código abstracto denominada código intermedio. Un
compilador también puede detener en breve la generación de código ejecutable real pero,
en vez de esto genera alguna forma de código ensamblador que debe ser procesado
adicionalmente por un ensamblador, un ligador y un cargador, los cuales pueden ser
proporcionados por el sistema operativo o compactados con el compilador.
En este capítulo nos concentraremos únicamente en los fundamentos de la generación del
código intermedio y el código ensamblador, los cuales tienen muchas características en
común. Ignoraremos el problema del procesamiento adicional del código ensamblador.
CÓDIGO INTERMEDIO Y ESTRUCTURAS DE DATOS PARA GENERACIÓN DE CÓDIGO
Una estructura de datos que representa el programa fuente durante la traducción se
denomina representación intermedia, o IR (por las siglas del término en inglés) para
abreviar. En este texto hasta ahora hemos usado un árbol sintáctico abstracto como el IR
principal. Además del IR, la principal estructura de datos utilizada durante la traducción es
la tabla de símbolos, la cual se estudió en el capítulo 6.
Aunque un árbol sintáctico abstracto es una representación adecuada del código fuente,
incluso para la generación de código (como veremos en una sección posterior), no se parece
ni remotamente al código objetivo, en particular en su representación de construcciones de
flujo de control, donde el código objetivo, como el código de máquina o código ensamblador,
emplean saltos más que construcciones de alto nivel, como las sentencias if y while. Por lo
tanto, un escritor de compiladores puede desear generar una nueva forma de
representación intermedia del árbol sintáctico que se parezca más al código objetivo o
reemplace del todo al árbol sintáctico mediante una representación intermedia de esa clase,

y entonces genere código objetivo de esta nueva representación. Una representación
intermedia de esta naturaleza que se parece al código objetivo se denomina código
intermedio.
El código intermedio puede tomar muchas formas: existen casi tantos estilos de código
intermedio como compiladores. Sin embargo, todos representan alguna forma de
linealización del árbol sintáctico, es decir, una representación del árbol sintáctico en forma
secuencial. El código intermedio puede ser de muy alto nivel, representar todas las
operaciones de manera casi tan abstracta como un árbol sintáctico, o parecerse mucho al
código objetivo. Puede o no utilizar información detallada acerca de la máquina objetivo y el
ambiente de ejecución, como los tamaños de los tipos de datos, las ubicaciones de las
variables y la disponibilidad de los registros. Puede o no incorporar toda la información
contenida en la tabla de símbolos, tal como los ámbitos, los niveles de anidación y los
desplazamientos de las variables. Si lo hace, entonces la generación de código objetivo
puede basarse sólo en el código intermedio; si no, el compilador debe retener la tabla de
símbolos para la generación del código objetivo.
El código intermedio es particularmente útil cuando el objetivo del compilador es producir
código muy eficiente, ya que para hacerlo así se requiere una cantidad importante del
análisis de las propiedades del código objetivo, y esto se facilita mediante el uso del código
intermedio. En particular, las estructuras de datos adicionales que incorporan información
de un detallado análisis posterior al análisis sintáctico se pueden generar fácilmente a partir
del código intermedio, aunque no es imposible hacerlo directamente desde el árbol
sintáctico.
El código intermedio también puede ser útil al hacer que un compilador sea más fácilmente
redirigible: si el código intermedio es hasta cierto punto independiente de la máquina
objetivo, entonces generar código para una máquina objetivo diferente sólo requiere volver
a escribir el traductor de código intermedio a código objetivo, y por lo regular esto es más
fácil que volver a escribir todo un generador de código.
En esta sección estudiaremos dos formas populares de código intermedio: el código de tres
direcciones y el código P. Ambos se presentan en muchas formas diferentes, y nuestro
estudio aquí se enfocará sólo en las características generales, en lugar de presentar una
descripción detallada de una versión de cada uno. Tales descripciones se pueden encontrar
en la literatura que se describe en la sección de notas y referencias al final del capítulo.

Código de tres direcciones
La instrucción básica del código de tres direcciones está diseñada para representar la
evaluación de expresiones aritméticas y tiene la siguiente forma general:
x = y op z

Esta instrucción expresa la aplicación del operador op a los valores de y y z, y la asignación
de este valor para que sea el nuevo valor de x. Aquí op puede ser un operador aritmético
como + o – o algún otro operador que pueda actuar sobre los valores de y y z.
El nombre “código de tres direcciones” viene de esta forma de instrucción, ya que por lo
general cada uno de los nombres x, y y z representan una dirección de la memoria. Sin
embargo, observe que el uso de la dirección de x difiere del uso de las direcciones de y y z, y
que tanto y como z (pero no x) pueden representar constantes o valores de literales sin
direcciones de ejecución.
Para ver cómo las secuencias de código de tres direcciones de esta forma pueden
representar el cálculo de una expresión, considere la expresión aritmética:
2 * a + (b – 3)
con árbol sintáctico:
(diagrama mostrado en la imagen).

El código de tres direcciones correspondiente es:
t1 = 2 * a
t2 = b - 3
t3 = t1 + t2
El código de tres direcciones requiere que el compilador genere nombres para elementos
temporales, a los que en este ejemplo hemos llamado t1, t2 y t3. Estos elementos
temporales corresponden a los nodos interiores del árbol sintáctico y representan sus
valores calculados, con el último elemento temporal (t3, en este ejemplo) representando el
valor de la raíz. La manera en que estos elementos temporales finalmente son asignados a
ubicaciones de memoria no es especificada por este código; por lo regular serán asignados a
registros, pero también se pueden conservar en registros de activación.
El código de tres direcciones que se acaba de dar representa una linealización de izquierda
a derecha del árbol sintáctico, debido a que el código correspondiente a la evaluación del
subárbol izquierdo de la raíz se lista primero. Es posible que un compilador desee utilizar
un orden diferente en ciertas circunstancias. Aquí simplemente advertimos que puede
haber otro orden para este código de tres direcciones, a saber (con un significado diferente
para los elementos temporales):
t1 = b - 3
t2 = 2 * a

t3 = t2 + t1
Evidentemente, la forma del código de tres direcciones que hemos mostrado no basta para
representar todas las características ni siquiera del lenguaje de programación más pequeño.
Por ejemplo, los operadores unitarios, como la negación, requieren de una variación del
código de tres direcciones que contenga sólo dos direcciones, tal como:
t2 = - t1
Si se desea tener capacidad para todas las construcciones de un lenguaje de programación
estándar, será necesario variar la forma del código de tres direcciones en cada construcción.
Si un lenguaje contiene características poco habituales, puede ser necesario incluso inventar
nuevas representaciones de código intermedio para esas características. Esta es una de las
razones por las que no existe una forma estándar para el código de tres direcciones (del
mismo modo que no existe una forma estándar para árboles sintácticos).
En las siguientes secciones de este capítulo trataremos algunas construcciones comunes de
los lenguajes de programación con la idea de ilustrar la manera en que éstas pueden
representarse en código de tres direcciones. Sin embargo, no intentaremos acostumbrarnos
a ningún formato rígido de código de tres direcciones, ya que esto limitaría su capacidad
para adaptarse a lenguajes de programación que contengan características inusuales.
Considere el programa para el lenguaje TINY de la sección 1.7 (capítulo 1) que calcula el
máximo común divisor de dos enteros positivos, usando el algoritmo de Euclides. El código
de tres direcciones de muestra para este programa se ofrece en la figura 8.2.

Figura 8.1 – Programa de muestra en lenguaje TINY: calcula el factorial
read x; { introducir un entero }
if 0 < x then { no calcular si x <= 0 }
fact := 1;
repeat
fact := fact * x;
x := x - 1
until x = 0;
write fact { salida del factorial de x }
end

Figura 8.2 – Código de tres direcciones para el programa TINY de la figura 8.1
read x
t1 = x > 0
if_false t1 goto L1
fact = 1
label L2
t2 = fact * x
fact = t2
t3 = x - 1
x = t3
t4 = x == 0
if_false t4 goto L2
write fact
label L1
halt

Varias formas diferentes de código de tres direcciones.
1. Las operaciones integradas de entrada y salida read y write se tradujeron
directamente en instrucciones de una dirección.
2. Existe una instrucción de salto condicional if_false que traduce tanto sentencias if
como sentencias repeat; contiene dos direcciones: el valor condicional que se
probará y la dirección de código a la que se saltará.
3. Las posiciones de las direcciones de salto también se indican mediante instrucciones
(de una dirección) label. Estas instrucciones label pueden ser innecesarias,
dependiendo de las estructuras de datos empleadas para implementar el código de
tres direcciones.
4. Una instrucción halt (sin direcciones) sirve para marcar el final del código.
Finalmente, observamos que las asignaciones en el código fuente producen la generación de
instrucciones de copia de la forma:

x=y
Por ejemplo, la sentencia del programa de muestra:
fact := fact * x;
Finalmente, observamos que las asignaciones en el código fuente producen la generación de
instrucciones de copia de la forma:
x=y
Por ejemplo, la sentencia del programa de muestra:
fact := fact * x;
se traduce en las dos instrucciones del código de tres direcciones:
t2 = fact * x
fact = t2
aunque sería suficiente una instrucción de tres direcciones. Esto sucede por razones
técnicas que se explicarán en la sección 8.2.

8.12 Estructuras de datos para la implementación del código de tres direcciones
El código de tres direcciones por lo regular no está implementado en forma textual como lo
hemos escrito (aunque podría estarlo). En vez de eso, cada instrucción de tres direcciones
está implementada como una estructura de registro que contiene varios campos, y la
secuencia completa de instrucciones de tres direcciones está implementada como un
arreglo o lista ligada, la cual se puede conservar en la memoria o escrita para (y leída desde)
archivos temporales cuando sea necesario.
La implementación más común consiste en implementar el código de tres direcciones
fundamentalmente como se muestra, lo que significa que son necesarios cuatro campos:
uno para la operación y tres para las direcciones. Para las instrucciones que necesitan
menos de tres direcciones, uno o más de los campos de dirección proporcionan un valor
nulo o “vacío”; la selección de los campos depende de la implementación. Como son
necesarios cuatro campos, una representación de código de tres direcciones de esta
naturaleza se denomina cuádruple. Una posible implementación cuádruple del código de
tres direcciones de la figura 8.2 se proporciona en la figura 8.3, donde se escribieron los
cuádruples en notación matemática de “tuplas”.
Los typedef posibles de C para implementar los cuádruples mostrados en la figura 8.3 se
ofrecen en la figura 8.4. En estas definiciones permitimos que una dirección sea sólo una
constante entera o una cadena (que representa el nombre de un elemento temporal o una

variable). También, puesto que se utilizan nombres, éstos deben introducirse en una tabla
de símbolos, y se necesitará realizar búsquedas durante procesamiento adicional. Una
alternativa para conservar los nombres en los cuádruples es mantener apuntadores hacia la
tabla de símbolos. Esto evita tener que realizar búsquedas adicionales y es particularmente
ventajoso en un lenguaje con ámbitos anidados, donde se necesita más de una tabla de
símbolos. Si se usa una tabla de símbolos, entonces no es necesaria una unión de tipo en el
campo de nombre para realizar una búsqueda. Si también se implementan los arreglos de
símbolos, entonces no es necesario utilizar las tablas.
Otra posible implementación del código de tres direcciones consiste en utilizar listas triples,
que contienen punteros hacia los elementos temporales. Estas evitan la necesidad de
manejar una tabla de símbolos. En la figura 8.5 se da una posible definición de la estructura
de registro para listas triples, donde cada instrucción de tres direcciones se almacena en un
nodo con tres punteros.

Figura 8.3
Implementación cuádruple para el código de tres direcciones de la figura 8.2
(rd, x, _, _)
(gt, x, 0, t1)
(if_f, t1, L1, _)
(asn, 1, fact, _)
(lab, L2, _, _)
(mul, fact, x, t2)
(asn, t2, fact, _)
(sub, x, 1, t3)
(asn, t3, x, _)
(eq, x, 0, t4)
(if_f, t4, L2, _)
(wri, fact, _, _)
(lab, L1, _, _)
(halt, _, _, _)

Figura 8.4
Código C que define estructuras de datos posibles para los cuádruples de la figura 8.3
typedef enum {rd, gt, if_f, asn, lab, mul, sub, eq, wri, halt, ...} OpKind;
typedef enum {Empty, IntConst, String} AddrKind;

typedef struct {
AddrKind kind;
union {
int val;
char *name;
} contents;
} Address;

typedef struct {
OpKind op;
Address addr1, addr2, addr3;
} Quad;

Un índice en un arreglo o como un apuntador en una lista ligada. Por ejemplo, una
representación abstracta de una implementación del código de tres direcciones de la figura
8.2 como triples se proporciona en la figura 8.5 (página 404). En esa figura utilizamos un
sistema de numeración que correspondería a índices de arreglo para representar los triples.
Las referencias de triple también se distinguen de las constantes poniéndolas entre
paréntesis en los mismos triples. Adicionalmente, en la figura 8.5 eliminamos las
instrucciones label y las reemplazamos con referencias a los índices de triple mismos.
Los triples son una manera eficiente para representar el código de tres direcciones, ya que
la cantidad de espacio se reduce y el compilador no necesita generar nombres para
elementos temporales. Sin embargo, los triples tienen una importante desventaja, y ésta
consiste en que, si se representa mediante índices de arreglo, entonces cualquier
movimiento de sus posiciones se vuelve difícil. Por otra parte, una representación de lista

ligada no sufre de esta deficiencia. Problemas adicionales que involucran triples, y el código
C apropiado para la definición de los mismos, se dejan como ejercicios.

Figura 8.5
Una representación del código de tres direcciones de la figura 8.2 como triples
(0) (rd, x, _, _)
(1) (gt, x, 0)
(2) (if_f, (1), (11))
(3) (asn, 1, fact)
(4) (mul, fact, x)
(5) (asn, (4), fact)
(6) (sub, x, 1)
(7) (asn, (6), x)
(8) (eq, x, 0)
(9) (if_f, (8), (4))
(10) (wri, fact, _, _)
(11) (halt, _, _, _)

8.13 Código P
El código P comenzó como un código ensamblador objetivo estándar producido por varios
compiladores Pascal en la década de 1970 y principios de la de 1980. Fue diseñado para ser
el código real de una máquina de pila hipotética, denominada máquina P, para la que se
escribió un intérprete en varias máquinas reales. La idea era hacer que los compiladores de
Pascal se transportaran fácilmente requiriendo solo que se volviera a escribir el intérprete
de la máquina P para una nueva plataforma. El código P también ha probado ser útil como
código intermedio, y se han utilizado varias extensiones y modificaciones del mismo en
diversos compiladores de código nativo, la mayor parte para lenguajes tipo Pascal.
Como el código P fue diseñado para ser directamente ejecutable, contiene una descripción
implícita de un ambiente de ejecución particular que incluye tamaños de datos, además de
mucha información específica para la máquina P, que se debe conocer si se desea que un
programa de código P sea comprensible. Para evitar este detalle describiremos aquí una
versión simplificada y abstracta de código P apropiada para la exposición. Las descripciones
de diversas versiones de código P real podrán encontrarse en varias referencias
enumeradas al final del capítulo.
Para nuestros propósitos la máquina P está compuesta por una memoria de código, una
memoria de datos no especificada para variables nombradas y una pila para datos
temporales, junto con cualquier registro que sea necesario para mantener la pila y apoyar la
ejecución.
Como un primer ejemplo de código P, considere la expresión
2 * a + (b - 3)
empleada en la sección 8.1.1, cuyo árbol sintáctico aparece en la página 399. Nuestra
versión de código P para esta expresión es la que se muestra en seguida:
ldc 2

; carga la constante 2

lod a

; carga el valor de la variable a

mpi

; multiplicación entera

lod b

; carga el valor de la variable b

ldc 3

; carga la constante 3

sbi

; sustracción o resta entera

adi

; adición de enteros

Estas instrucciones se ven como si representaran las siguientes operaciones en una
máquina P. En primer lugar, ldc 2 inserta el valor 2 en la pila temporal. Luego, lod a inserta
el valor de la variable a en la pila. La instrucción mpi extrae estos dos valores de la pila, los
multiplica (en orden inverso) e inserta el resultado en la pila. Las siguientes dos
instrucciones (lod b y ldc 3) insertan el valor de b y la constante 3 en la pila (ahora tenemos
tres valores en la pila). Posteriormente, la instrucción sbi extrae los dos valores superiores
de la pila, resta el primero del segundo, e inserta el resultado. Finalmente, la instrucción adi
extrae los dos valores restantes de la pila, los suma e inserta el resultado. El código finaliza
con un solo valor en la pila, que representa el resultado del cálculo.
Como un segundo ejemplo introductorio, considere la sentencia de asignación
x := y + 1
Esto corresponde a las siguientes instrucciones en código P:
lda x ; carga dirección de x
lod y ; carga valor de y
ldc 1 ; carga constante 1
adi

; suma

sto

; almacena tope a dirección
; debajo del tope y extrae ambas

Advierta cómo este código calcula primero la dirección de x, luego el valor de la expresión
que será asignada a x, y finalmente ejecuta un comando sto, el cual requiere que se
encuentren dos valores en la parte superior de la pila temporal: el valor que será
almacenado y, debajo de éste, la dirección en la memoria variable en la cual se almacenará.
La instrucción sto extrae ambos valores (dejando la pila vacía en este ejemplo). De este
modo el código P hace una distinción entre direcciones de carga (lda) y valores ordinarios
(lod), que corresponden a la diferencia entre el uso de x en el lado izquierdo y el uso de y en
el lado derecho de la asignación x := y + 1.
Como último ejemplo de código P en esta sección damos una traducción de código P en la
figura 8.6 para el programa TINY de la figura 8.1, junto con comentarios que describen cada
operación.
El código P de la figura 8.6 (página 406) contiene varias instrucciones nuevas de código P.
En primer lugar, las instrucciones rd y wrt (sin parámetros) implementan las sentencias
read y write del lenguaje TINY. La instrucción de código P ldi requiere un parámetro
adicional que da el valor cuya valor va a leerse se encuentra en la parte superior de la pila, y
esa dirección es extraída como parte de la instrucción. La instrucción sti requiere que el

valor que será escrito esté en la parte superior de la pila, y ese valor se escribe como parte
de la instrucción.
Otras instrucciones de código P que aparecen en la figura 8.6 que no han sido mencionadas
son: la instrucción lab, que define la posición de una etiqueta; la instrucción fjp (“false
jump”), que requiere un valor booleano en el tope o parte superior de la pila (el cual es
extraído); la instrucción sbi (de “sustracción entera”); las instrucciones les y equ, que son
análogas a las de las instrucciones aritméticas; y las operaciones de relación “<” (“less
than”) y “=” (“equal to”), que producen un valor booleano (1 o 0) en la pila (los cuales son
extraídos), y que insertan sus resultados booleanos. Finalmente, el programa termina con la
instrucción hlt al detener el anterior código P y su ejecución (“stop”).
Comparación del código P con el código de tres direcciones
El código P en muchos aspectos está más cercano al código de máquina real que al código de
tres direcciones. Las instrucciones en código P también requieren menos direcciones: todas
las instrucciones que hemos visto son instrucciones de “una dirección” o “cero direcciones”.
Por otra parte, el código P es menos compacto que el código de tres direcciones en términos
de números de instrucciones, y el código P no está “autocontenido” en el sentido que las
instrucciones funcionen implícitamente en una pila (y las localidades de pila implícitas son
de hecho las direcciones “perdidas”). La ventaja respecto a la pila es que contiene todos los
valores temporales necesarios en cada punto del código, y el compilador no necesita asignar
nombres a ninguno de ellos, como en el código de tres direcciones.

TÉCNICAS BÁSICAS DE GENERACIÓN DE CÓDIGO
En esta sección comentaremos los enfoques básicos para la generación de código en
general, mientras que en secciones posteriores abordaremos la generación de código para
construcciones de lenguaje individuales por separado.
8.21 Código intermedio o código objetivo como un atributo sintetizado
La generación de código intermedio (o generación de código objetivo directa sin código
intermedio) se puede ver como un cálculo de atributo similar a muchos de los problemas de
atributo estudiados previamente. En realidad, si el código se genera de ese modo es un
atributo de cadena (con instrucciones separadas por caracteres de retorno de línea),
entonces este código se convierte en un atributo sintetizado que se puede definir utilizando
una gramática con atributos, y generado directamente durante el análisis sintáctico o
mediante un recorrido posterior del árbol sintáctico.
Para ver cómo el código de tres direcciones, o bien, el código P se pueden definir como un
atributo sintetizado, considere la siguiente gramática que representa un pequeño
subconjunto de expresiones en C:
exp → id = exp | aexp

aexp → aexp + factor | factor
factor → ( exp ) | num | id
Esta gramática sólo contiene dos operaciones, la asignación (con el símbolo =) y la adición
(con el símbolo +). El token id representa un identificador simple, y el token num simboliza
una secuencia simple de dígitos que representan un entero. Se supone que ambos tokens
tienen un atributo strval previamente calculado, que es el valor de la cadena, o lexema, del
token (por ejemplo, “42” para un num o “xtemp” para un id).
Código P Consideraremos el caso de la generación del código P en primer lugar, ya que la
gramática con atributos es más simple debido a que no es necesario generar nombres para
elementos temporales. Sin embargo, la existencia de asignaciones incrustadas es un factor
que implica complicaciones. En esta situación deseamos mantener el valor almacenado
como el valor resultante de una expresión de asignación, ya que la instrucción de código P
estándar sto es destructiva, pues el valor asignado se pierde. (Con esto el código P muestra
sus orígenes de Pascal, en el cual no existen las asignaciones incrustadas.) Resolvemos este
problema introduciendo una instrucción de almacenamiento no destructiva stn en
nuestro código P, la que como la instrucción sto, supone que se encuentra un valor en la
parte superior o tope de la pila y una dirección debajo de la misma; stn almacena el valor en
la dirección pero deja el valor en el tope de la pila, mientras que descarta la dirección.
Con esta nueva instrucción, una gramática con atributos para un atributo de cadena de
código.
P se proporciona en la tabla 8.1. En esa figura utilizamos el nombre de atributo pcode para
la cadena de código P. También empleamos dos notaciones diferentes para la concatenación
de cadenas: ++ cuando las instrucciones van a ser concatenadas con retornos de línea
insertados entre ellas y ␣ cuando se está construyendo una instrucción simple y se va a
insertar un espacio.
Dejamos al lector describir el cálculo del atributo pcode en ejemplos individuales y mostrar
que, por ejemplo, la expresión (x = x + 3) + 4 tiene este atributo
lda x
lod x
ldc 3
adi
stn
ldc 4
adi

Tabla 8.1
Gramática con atributos de código P como un atributo de cadena sintetizado

Código de tres direcciones
Una gramática con atributos para código de tres direcciones de la gramática de expresión
simple anterior se proporciona en la tabla 8.2. En este caso utilizamos el atributo de código
que se llama facode (para código de tres direcciones), y como en la tabla 8.1, ++ para
concatenación de cadena con un retorno de línea y ␣ para concatenación de cadena con un
espacio. A diferencia del código P, el código de tres direcciones requiere que se generen
nombres temporales para resultados de medios en las expresiones. Esto requiere que la
gramática con atributos incluya un nuevo atributo name para cada nodo. Este atributo es
sintetizado, pero para asignar nombres temporales diferentes a los nodos interiores
utilizamos una función newtemp() que se supone genera secuencias de nombres
temporales t₁, t₂, t₃... (Se devuelve un nuevo valor cada vez que se llama newtemp()). En el
simple ejemplo solo los nodos de expresión no terminales generan nuevos nombres
temporales; la operación de asignación simplemente utiliza a nombre de la variable de
destino, el id de la producción exp → id = exp.
Advierta en la tabla 8.2 que, en el caso de las producciones unitarias exp → exp + factor y
factor → ( exp ), los atributos facode se transportan de hijos a padres y viceversa, de modo
que los nodos interiores también copian las producciones de hoja.
En el facode observado, observe también que en las producciones de hoja factor → num y
factor → id, el valor de cadena del token se combina con factor.name, que...
Código de tres direcciones
Una gramática con atributos para código de tres direcciones de la gramática de expresión
simple anterior se proporciona en la tabla 8.2. En esa tabla utilizamos el atributo de código
que se llama tacode (para código de tres direcciones), y como en la tabla 8.1, ++ para

concatenación de cadena con un retorno de línea y || para concatenación de cadena con un
espacio. A diferencia del código P, el código de tres direcciones requiere que se generen
nombres temporales para resultados intermedios en las expresiones, y esto requiere que la
gramática con atributos incluya un nuevo atributo name para cada nodo. Este atributo
también es sintetizado, pero para asignar nombres temporales recién generados a nodos
interiores utilizamos una función newtemp() que se supone genera una secuencia de
nombres temporales t1, t2, t3, … (se devuelve uno nuevo cada vez que se llama a
newtemp()). En este ejemplo simple sólo los nodos correspondientes al operador +
necesitan nuevos nombres temporales; la operación de asignación simplemente utiliza el
nombre de la expresión en el lado derecho.
Advierta en la tabla 8.2 que, en el caso de las producciones unitarias exp → aexp y aexp →
factor, el atributo name, además del atributo tacode, se transportan de hijos a padres y que,
en el caso de los nodos interiores del operador, se generan nuevos atributos name antes del
tacode asociado. Observe también que, en las producciones de hoja factor → num y factor →
id, el valor de cadena del token se utiliza como factor.name, y que (a diferencia del código P)
no se genera ningún código de tres direcciones en tales nodos (utilizamos “” para
representar la cadena vacía).

De nueva cuenta, dejamos al lector mostrar que, dadas las ecuaciones de atributo de la tabla
8.2, la expresión (x = x + 3) + 4 tiene el atributo tacode

(Esto supone que newtemp() es llamado en postorden y genera nombres temporales
comenzando con t1). Advierta cómo la asignación x = x + 3 genera dos instrucciones de tres
direcciones utilizando un elemento temporal. Esto es una consecuencia del hecho de que la
evaluación de atributos siempre crea un elemento temporal para cada subexpresión,
incluyendo los lados derechos de las asignaciones.
Visualizar la generación de código como el cálculo de un atributo de cadena sintetizado es
útil para mostrar claramente las relaciones entre las secuencias de código de las diferentes
partes del árbol sintáctico y para comparar los diferentes métodos de generación de código,
pero es poco práctico como técnica para generación de código real, por varias razones. En
primer lugar, el uso de la concatenación de cadena causa que se desperdicie una cantidad
desmesurada de copiado de cadenas y memoria a menos que los operadores de la
concatenación sean muy complejos. En segundo, por lo regular es mucho más deseable
generar pequeños segmentos de código a medida y continúa la generación de código y
escribir estos segmentos en un archivo o bien insertarlos en una estructura de datos (tal
como un arreglo de cuádruples), lo que requiere acciones semánticas que no se adhieren a
las sencillas postorden estándar de las gramáticas. Finalmente, es útil visualizar el código
como puramente sintetizado, la generación de código depende del análisis de los atributos
heredados, y esto complica en gran medida las gramáticas con atributos. Es por esto que no
nos preocupamos aquí por escribir ningún código (incluso pseudocódigo) para
implementar las gramáticas con atributos de los ejemplos anteriores (pero vea los
ejercicios). En vez de eso, en la siguiente subsección regresaremos a técnicas de generación
de código más directas.

8.2.2 Generación de código práctica
Las técnicas estándar de generación de código involucran modificaciones de los recorridos
postorden del árbol sintáctico implicado por las gramáticas con atributos de los ejemplos
precedentes o, si no se genera un árbol sintáctico de manera explícita, acciones equivalentes
durante un análisis sintáctico. El algoritmo básico puede ser descrito como el siguiente
procedimiento recursivo (para nodos de árbol con dos hijos como máximo, pero fácilmente
extensibles a más):
procedure genCode (T : treenode);
begin
if T no es nil then
genere código para preparar en el caso del código del hijo izquierdo de T;
genCode(hijo izquierdo de T);

genere código para preparar en el caso del código del hijo derecho de T;
genCode(hijo derecho de T);
genere código para implementar la acción de T;
end;

Implementación de un procedimiento de generación de código para código P
correspondiente a la gramática con atributos de la tabla 8.1

Generación de código objetivo a partir del código intermedio
Si un compilador genera código intermedio, ya sea directamente durante un análisis
sintáctico o desde un árbol sintáctico, entonces debe efectuarse otro paso en el código
intermedio para generar el código objetivo final (por lo regular después de algún
procesamiento adicional del código intermedio). Este paso puede ser bastante complejo por
sí mismo, en particular si el código intermedio es muy simbólico y contiene poca o ninguna
información acerca de la máquina objetivo o el ambiente de ejecución. En este caso, el paso
de la generación de código final debe suministrar todas las ubicaciones reales de variables y
temporales, más el código necesario para mantener el ambiente de ejecución. Una cuestión
particularmente importante es la asignación apropiada de los registros y el mantenimiento
de la información sobre el uso de los mismos (es decir, cuáles registros se encuentran
disponibles y cuáles contienen valores conocidos). Aplazaremos un análisis detallado de

tales cuestiones de asignación hasta más adelante en este capítulo. Por ahora
comentaremos sólo técnicas generales para este proceso.
Por lo regular la generación de código a partir del código intermedio involucra alguna o
ambas de las dos técnicas estándar: expansión de macro y simulación estática.
La expansión de macro involucra el reemplazo de cada clase de instrucción del código
intermedio con una secuencia equivalente de instrucciones de código objetivo. Esto
requiere que el compilador se mantenga al tanto de las decisiones acerca de ubicaciones e
idiomas de código en estructuras de datos separadas y que los procedimientos del macro
varíen la secuencia de código como se requiera mediante las clases particulares de datos
involucradas en la instrucción de código intermedio. De este modo, cada paso puede ser
mucho más complejo que las formas simples de expansión de macro disponibles del
preprocesador de C o ensambladores de macro.
La simulación estática involucra una simulación en línea recta de los efectos del código
intermedio y generación de código objetivo para igualar estos efectos. Esto también
requiere de más estructuras de datos, y puede variar de formas muy simples de seguimiento
empleadas en conjunto con la expansión de macro, hasta la altamente sofisticada
interpretación abstracta (que mantiene los valores algebraicamente a medida que son
calculados).
Podemos obtener alguna idea de los detalles de estas técnicas considerando el problema de
traducir desde el código P al código de tres direcciones y viceversa. Consideremos la
pequeña gramática de expresión que hemos estado utilizando como ejemplo de ejecución
en esta sección, y consideremos la expresión (x = x + 3) + 4.
Consideremos primero la traducción del código P para esta expresión:

GENERACIÓN DE CÓDIGO DE SENTENCIAS DE CONTROL Y EXPRESIONES LÓGICAS

En esta sección describiremos la generación de código para varias formas de sentencias de
control. Entre éstas se encuentran principalmente la sentencia if y la sentencia while
estructuradas, las que veremos con detalle en la primera parte de esta sección. También
incluimos en esta descripción el uso de la sentencia break (como en C), pero no
comentaremos el control de bajo nivel como el de la sentencia goto, puesto que tales
sentencias se pueden implementar con facilidad directamente en código intermedio o
código objetivo. Otras formas de control estructurado, como la sentencia repeat (o la
sentencia do-while), la sentencia for y la sentencia case (o sentencia switch), se dejan para
los ejercicios. Otra técnica de implementación útil para la sentencia switch, denominada
tabla de salto, también se describe en un ejercicio.
La generación de código intermedio para sentencias de control, tanto en código de tres
direcciones como en código P, involucra la generación de etiquetas de una manera similar a
la generación de nombres temporales en el código de tres direcciones, pero en este caso
representan direcciones en el código objetivo a las que se harán los saltos. Si las etiquetas
están por eliminarse en la generación de código objetivo, entonces surge un problema, ya
que los saltos a localidades de código que ya no son conocidas se deben reajustar o
reescribir retroactivamente. Comentaremos esto en la siguiente parte de esta sección.
Las expresiones lógicas, o booleanas, que se utilizan como pruebas de control, y que
también se pueden emplear de manera independiente como datos, se analizan a
continuación, particularmente respecto a la evaluación de cortocircuito, en la cual
difieren de las expresiones aritméticas.
Finalmente, en esta sección presentaremos un procedimiento de generación de código de
muestra en código P para sentencias if y while.
Un procedimiento de generación de código de muestra para sentencias if y while
En esta sección mostraremos un procedimiento de generación de código para sentencias de
control utilizando la siguiente gramática simplificada:

Por simplicidad, esta gramática utiliza el token other para representar sentencias no
incluidas en la gramática (como la sentencia de asignación). También incluye únicamente
las expresiones booleanas constantes true y false. Incluye una sentencia break para
mostrar cómo una sentencia así se puede implementar utilizando una etiqueta heredada
pasada como un parámetro.

Con la siguiente declaración en C se puede implementar un árbol sintáctico abstracto para
esta gramática:

En la figura se proporciona un procedimiento de generación de código que genera código P
utilizando los typedef dados y la correspondiente estructura de árbol sintáctico. Acerca de
este código hacemos las observaciones siguientes:

En primer lugar, el código supone, como antes, la existencia de un procedimiento emitCode
(este procedimiento simplemente imprimiría la cadena que se le pase). El código también
supone la existencia de un procedimiento genLabel sin parámetros, que devuelve nombres
de etiqueta en la secuencia L1, L2, L3, y así sucesivamente.
El procedimiento genCode aquí tiene un parámetro label extra que es necesario para
generar un salto absoluto en el caso de una sentencia break. Este parámetro sólo se cambia
en la llamada recursiva que procesa el cuerpo de una sentencia while. De este modo, una
sentencia break siempre provocará un salto fuera de la sentencia while anidada más
cercana. (La llamada inicial a genCode puede utilizar una cadena vacía como el parámetro
label, y cualquier sentencia break que se encuentre fuera de una sentencia while generará
entonces un salto a una etiqueta vacía y, en consecuencia, un error.)
Advierta también cómo las variables locales lab1 y lab2 se emplean para guardar nombres
de etiqueta, para los cuales existen saltos y/o definiciones aún pendientes.
Por último, puesto que una sentencia other no corresponde a ningún código real, en este
caso este procedimiento simplemente genera la instrucción en código no P “Other”.

TM: UNA MÁQUINA OBJETIVO SIMPLE
En la siguiente sección presentaremos un generador de código para el lenguaje TINY. Para
hacer de ésta una tarea significativa, generamos código objetivo directamente para una
máquina muy simple que se pueda simular con facilidad. Llamaremos a esta máquina TM
(por Tiny Machine) y en el apéndice C proporcionaremos un listado de programa en C de un
simulador TM completo que se puede emplear para ejecutar el código producido por el
generador de código TINY. En la sección actual describiremos la arquitectura TM completa y
el conjunto de instrucciones, además del uso del simulador del apéndice C. Con el fin de
facilitar la comprensión emplearemos fragmentos de código en C para ayudar a esta
descripción, y las mismas instrucciones TM siempre se darán en formato de código
ensamblado en vez de hacerlo en códigos binario o hexadecimal. (En cualquier caso el
simulador sólo lee código ensamblado.)

Arquitectura básica de la máquina TINY
TM se compone de una memoria de instrucción sólo de lectura, una memoria de datos, y un
conjunto de ocho registros de propósito general. Todos éstos utilizan direcciones enteras no
negativas que comienzan en 0. El registro 7 es el contador del programa y es el único
registro especial, como se describe a continuación. Las declaraciones en C
#define IADDR_SIZE ...
/* tamaño de la memoria de la instrucción */
#define DADDR_SIZE ...
/* tamaño de la memoria de datos */
#define NO_REGS 8 /* número de registros */
#define PC_REG 7
Instruction iMem[IADDR_SIZE];
int dMem[DADDR_SIZE];
int reg[NO_REGS];

Se utilizarán en las descripciones que siguen.
La TM realiza un ciclo convencional de obtención-ejecución:
do
/* obtención */

currentInstruction = iMem[reg[pcRegNo]++] ;
/* ejecuta la instrucción actual */
...
while (!(halt || error)) ;
Al comienzo, la máquina TINY establece todos los registros y memoria de datos a 0, luego
carga el valor de la dirección legal más alta (a saber, DADDR_SIZE - 1) en dMem[0]. (Esto
permite que la memoria se agregue fácilmente a la TM, puesto que los programas pueden
averiguar durante la ejecución de cuánta memoria se dispone.)
La TM comienza entonces a ejecutar las instrucciones comenzando en iMem[0].
La máquina se detiene cuando se ejecuta una instrucción HALT.
Las condiciones de error posibles incluyen a IMEM_ERR, que se presenta si reg[PC_REG] <
0 o si reg[PC_REG] ≥ IADDR_SIZE en el paso de obtención anterior, y las dos condiciones
DMEM_ERR y ZERO_DIV, las cuales se presentan durante la ejecución de instrucciones
como se describió anteriormente.
El conjunto de instrucciones de la TM se proporciona en la figura 8.15, junto con una breve
descripción del efecto de cada instrucción.
Existen dos formatos de instrucción básicos:
•

sólo de registro, o instrucciones RO, y

•

de memoria de registro, o instrucciones RM.

Una instrucción sólo de registro tiene el formato...
Opcode r,s,t

donde los operandos r, s, t son registros legales (verificados en tiempo de carga). De este
modo, tales instrucciones son tres direcciones, y las tres direcciones deben ser registros.
Todas las instrucciones aritméticas se encuentran limitadas a este formato, como lo están
las dos instrucciones primitivas de entrada/salida.

Una instrucción de memoria de registro tiene el formato
opcode r, d(s)
En este código r y s deben ser registros legales (verificados en tiempo de carga), y d es un
entero positivo o negativo que representa un desplazamiento. Esta instrucción es una
instrucción de dos direcciones, donde la primera dirección es siempre un registro y la
segunda dirección es una dirección de memoria a dada por a = d + reg[r], donde a debe ser
una dirección legal (0 ≤ a < DADDR_SIZE). Si a está fuera del intervalo legal, entonces se
genera DMEM_ERR durante la ejecución.


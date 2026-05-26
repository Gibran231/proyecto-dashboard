from flask import Flask, jsonify, render_template, request
import oracledb
import json

app = Flask(__name__)

# =========================================================
# CONEXIÓN ORACLE
# =========================================================

def obtener_conexion():
    return oracledb.connect(
        user="AMD_PROYECTO",
        password="12a34b56C1?",
        dsn="localhost:1521/XE"
    )


# =========================================================
# CLASIFICACIÓN ÚNICA PARA CALIDAD DEL AIRE
# =========================================================

def clasificar_ica(valor):
    """
    Escala única para TODO el módulo de Calidad del Aire.
    Así la tabla, tarjetas y mapas clasifican igual.
    """
    try:
        v = float(valor)
    except (TypeError, ValueError):
        return {"categoria": "Sin categoría", "color": "#94A3B8", "clase": "regular"}

    if v <= 25:
        return {"categoria": "Bueno", "color": "#2BC55B", "clase": "bueno"}
    if v <= 50:
        return {"categoria": "Regular", "color": "#FFD93D", "clase": "regular"}
    if v <= 75:
        return {"categoria": "Desfavorable", "color": "#FF8A36", "clase": "desfavorable"}
    if v <= 100:
        return {"categoria": "Muy desfavorable", "color": "#D92E2E", "clase": "peligroso"}
    return {"categoria": "Extremadamente desfavorable", "color": "#8A2BE2", "clase": "extremo"}

# =========================================================
# RUTA PRINCIPAL
# =========================================================

@app.route("/")
def inicio():
    return render_template("index.html")

# =========================================================
# API: FILTROS CALIDAD DEL AIRE
# =========================================================

@app.route("/api/filtros")
def api_filtros():
    conexion = None
    cursor = None
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT Codigo, Descripcion
            FROM TIPO_ZONA
            ORDER BY Descripcion
        """)
        tipos_zona = [
            {"codigo": f[0], "descripcion": f[1]}
            for f in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT DISTINCT Year_Inicio
            FROM PERIODO
            WHERE Year_Inicio IS NOT NULL
            ORDER BY Year_Inicio
        """)
        anios = [
            {"anio": f[0]}
            for f in cursor.fetchall()
        ]

        cursor.execute("""
            SELECT Id_Contaminante, Nombre
            FROM CONTAMINANTE
            ORDER BY Nombre
        """)
        contaminantes = [
            {"id": f[0], "nombre": f[1]}
            for f in cursor.fetchall()
        ]

        return jsonify({
            "tipos_zona": tipos_zona,
            "anios": anios,
            "contaminantes": contaminantes
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: DASHBOARD CALIDAD DEL AIRE
# =========================================================

@app.route("/api/dashboard")
def api_dashboard():
    tipo_zona = request.args.get("tipo_zona")
    anio = request.args.get("anio")
    id_contaminante = request.args.get("id_contaminante")

    conexion = None
    cursor = None

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        if not tipo_zona:
            cursor.execute("SELECT Codigo FROM TIPO_ZONA WHERE ROWNUM = 1")
            tipo_zona = cursor.fetchone()[0]

        if not anio:
            cursor.execute("SELECT MIN(Year_Inicio) FROM PERIODO WHERE Year_Inicio IS NOT NULL")
            anio = cursor.fetchone()[0]

        if not id_contaminante:
            cursor.execute("SELECT Id_Contaminante FROM CONTAMINANTE WHERE ROWNUM = 1")
            id_contaminante = cursor.fetchone()[0]

        anio = int(anio)
        id_contaminante = int(id_contaminante)

        # TABLA PRINCIPAL
        cursor.execute("""
            SELECT
                M.Zona,
                M.ICA,
                IC.Categoria,
                M.Medicion,
                M.Unidad,
                M.Latitud,
                M.Longitud,
                IC.Color
            FROM (
                SELECT
                    Z.Nombre AS Zona,
                    ROUND(AVG(R.Valor_Promedio), 2) AS ICA,
                    MAX(T.Tipo) AS Medicion,
                    MAX(U.Unidad) AS Unidad,
                    Z.Latitud,
                    Z.Longitud,
                    C.Id_Contaminante
                FROM REGISTRO R
                LEFT JOIN ZONA Z ON Z.Id_Zona = R.Id_Zona
                LEFT JOIN TIPO_ZONA TZ ON TZ.Codigo = Z.Codigo
                LEFT JOIN PERIODO P ON P.Id_Periodo = R.Id_Periodo
                LEFT JOIN INDICADOR_AMBIENTAL IA ON IA.Id_Indicador_Ambiental = R.Id_Indicador_Ambiental
                LEFT JOIN CONTAMINANTE C ON C.Id_Contaminante = IA.Id_Contaminante
                LEFT JOIN TIPO_MEDICION T ON T.Id_Tipo_Medicion = R.Id_Tipo_Medicion
                LEFT JOIN UNIDAD_MEDICION U ON U.Id_Unidad_Medicion = R.Id_Unidad_Medicion
                WHERE TZ.Codigo = :tipo_zona
                  AND P.Year_Inicio = :anio
                  AND C.Id_Contaminante = :id_contaminante
                GROUP BY Z.Nombre, Z.Latitud, Z.Longitud, C.Id_Contaminante
            ) M
            LEFT JOIN ICA IC
                ON IC.Id_Contaminante = M.Id_Contaminante
               AND M.ICA BETWEEN IC.Valor_Min AND IC.Valor_Max
            ORDER BY M.ICA DESC
        """, {
            "tipo_zona": tipo_zona,
            "anio": anio,
            "id_contaminante": id_contaminante
        })

        filas = cursor.fetchall()
        tabla = []
        valores = []

        for f in filas:
            ica = float(f[1]) if f[1] is not None else 0
            valores.append(ica)
            tabla.append({
                "zona": f[0],
                "ica": ica,
                "estatus": clasificar_ica(ica)["categoria"],
                "medicion": f[3] if f[3] else "N/A",
                "unidad": f[4] if f[4] else "N/A",
                "latitud": float(f[5]) if f[5] is not None else None,
                "longitud": float(f[6]) if f[6] is not None else None,
                "color": clasificar_ica(ica)["color"],
                "clase": clasificar_ica(ica)["clase"]
            })

        maximo = max(valores) if tabla else 0
        promedio = round(sum(valores) / len(valores), 2) if tabla else 0
        zona_mas_contaminada = tabla[0]["zona"] if tabla else "Sin datos"

        grafica_presencia = {
            "labels": [x["zona"] for x in tabla],
            "valores": [x["ica"] for x in tabla]
        }

        # HISTÓRICO / PROYECCIÓN
        cursor.execute("""
            SELECT
                TO_CHAR(R.Fecha_Inicio, 'YYYY') AS Anio,
                ROUND(AVG(R.Valor_Promedio), 2) AS Promedio
            FROM REGISTRO R
            LEFT JOIN ZONA Z ON R.Id_Zona = Z.Id_Zona
            LEFT JOIN TIPO_ZONA TZ ON TZ.Codigo = Z.Codigo
            LEFT JOIN INDICADOR_AMBIENTAL IA ON R.Id_Indicador_Ambiental = IA.Id_Indicador_Ambiental
            LEFT JOIN CONTAMINANTE C ON IA.Id_Contaminante = C.Id_Contaminante
            WHERE TZ.Codigo = :tipo_zona
              AND C.Id_Contaminante = :id_contaminante
            GROUP BY TO_CHAR(R.Fecha_Inicio, 'YYYY')
            ORDER BY Anio
        """, {
            "tipo_zona": tipo_zona,
            "id_contaminante": id_contaminante
        })

        historico = cursor.fetchall()
        proyeccion = {
            "labels": [f[0] for f in historico],
            "valores": [float(f[1]) for f in historico]
        }

        # MAPA CONTAMINANTE DOMINANTE
        cursor.execute("""
            SELECT
                M.Zona,
                M.Contaminante,
                M.Latitud,
                M.Longitud,
                M.Promedio,
                IC.Categoria,
                IC.Color
            FROM (
                SELECT
                    Z.Id_Zona,
                    Z.Nombre AS Zona,
                    C.Id_Contaminante,
                    C.Nombre AS Contaminante,
                    Z.Latitud,
                    Z.Longitud,
                    ROUND(AVG(R.Valor_Promedio), 2) AS Promedio,
                    ROW_NUMBER() OVER(
                        PARTITION BY Z.Id_Zona
                        ORDER BY AVG(R.Valor_Promedio) DESC
                    ) AS RN
                FROM REGISTRO R
                LEFT JOIN ZONA Z ON R.Id_Zona = Z.Id_Zona
                LEFT JOIN TIPO_ZONA TZ ON TZ.Codigo = Z.Codigo
                LEFT JOIN PERIODO P ON R.Id_Periodo = P.Id_Periodo
                LEFT JOIN INDICADOR_AMBIENTAL IA ON R.Id_Indicador_Ambiental = IA.Id_Indicador_Ambiental
                LEFT JOIN CONTAMINANTE C ON IA.Id_Contaminante = C.Id_Contaminante
                WHERE TZ.Codigo = :tipo_zona
                  AND P.Year_Inicio = :anio
                  AND Z.Latitud IS NOT NULL
                  AND Z.Longitud IS NOT NULL
                GROUP BY Z.Id_Zona, Z.Nombre, C.Id_Contaminante, C.Nombre, Z.Latitud, Z.Longitud
            ) M
            LEFT JOIN ICA IC
                ON M.Id_Contaminante = IC.Id_Contaminante
               AND M.Promedio BETWEEN IC.Valor_Min AND IC.Valor_Max
            WHERE M.RN = 1
            ORDER BY M.Promedio DESC
        """, {
            "tipo_zona": tipo_zona,
            "anio": anio
        })

        mapa_filas = cursor.fetchall()
        contaminante_dominante = []
        for f in mapa_filas:
            promedio_mapa = float(f[4]) if f[4] is not None else 0
            escala = clasificar_ica(promedio_mapa)
            contaminante_dominante.append({
                "zona": f[0],
                "contaminante": f[1],
                "latitud": float(f[2]) if f[2] is not None else None,
                "longitud": float(f[3]) if f[3] is not None else None,
                "promedio": promedio_mapa,
                "estatus": escala["categoria"],
                "color": escala["color"],
                "clase": escala["clase"]
            })

        dominante = contaminante_dominante[0]["contaminante"] if contaminante_dominante else "Sin datos"

        return jsonify({
            "maximo": maximo,
            "promedio": promedio,
            "zona_mas_contaminada": zona_mas_contaminada,
            "zona_mas_riesgo": zona_mas_contaminada,
            "dominante": dominante,
            "tabla": tabla,
            "grafica_presencia": grafica_presencia,
            "proyeccion": proyeccion,
            "contaminante_dominante": contaminante_dominante
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: FILTROS SALUD (anios, contaminantes, zonas, salud)
# =========================================================

@app.route("/api/filtros_salud")
def api_filtros_salud():
    anio = request.args.get("anio", "")
    contaminante = request.args.get("contaminante", "")
    zona = request.args.get("zona", "")
    salud = request.args.get("salud", "")

    conexion = None
    cursor = None

    def n(v):
        return v if v != "" else None

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        # Años
        cursor.execute("""
            SELECT DISTINCT p.Year_Inicio
            FROM REGISTRO r
            INNER JOIN PERIODO p ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN ZONA z ON r.Id_Zona = z.Id_Zona
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            LEFT JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE (:contaminante IS NULL OR c.Nombre = :contaminante)
              AND (:zona IS NULL OR z.Nombre = :zona)
              AND (:salud IS NULL OR s.Descripcion = :salud)
            ORDER BY p.Year_Inicio
        """, {"contaminante": n(contaminante), "zona": n(zona), "salud": n(salud)})
        anios = [{"anio": f[0]} for f in cursor.fetchall()]

        # Contaminantes
        cursor.execute("""
            SELECT DISTINCT c.Nombre
            FROM REGISTRO r
            INNER JOIN PERIODO p ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN ZONA z ON r.Id_Zona = z.Id_Zona
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            LEFT JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE (:anio IS NULL OR p.Year_Inicio = :anio)
              AND (:zona IS NULL OR z.Nombre = :zona)
              AND (:salud IS NULL OR s.Descripcion = :salud)
            ORDER BY c.Nombre
        """, {"anio": int(anio) if anio else None, "zona": n(zona), "salud": n(salud)})
        contaminantes_list = [{"nombre": f[0]} for f in cursor.fetchall()]

        # Zonas
        cursor.execute("""
            SELECT DISTINCT z.Nombre
            FROM REGISTRO r
            INNER JOIN PERIODO p ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN ZONA z ON r.Id_Zona = z.Id_Zona
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            LEFT JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE (:anio IS NULL OR p.Year_Inicio = :anio)
              AND (:contaminante IS NULL OR c.Nombre = :contaminante)
              AND (:salud IS NULL OR s.Descripcion = :salud)
            ORDER BY z.Nombre
        """, {"anio": int(anio) if anio else None, "contaminante": n(contaminante), "salud": n(salud)})
        zonas_list = [{"nombre": f[0]} for f in cursor.fetchall()]

        # Indicadores de salud
        cursor.execute("""
            SELECT DISTINCT s.Descripcion
            FROM REGISTRO r
            INNER JOIN PERIODO p ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN ZONA z ON r.Id_Zona = z.Id_Zona
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            LEFT JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE (:anio IS NULL OR p.Year_Inicio = :anio)
              AND (:contaminante IS NULL OR c.Nombre = :contaminante)
              AND (:zona IS NULL OR z.Nombre = :zona)
              AND s.Descripcion IS NOT NULL
            ORDER BY s.Descripcion
        """, {"anio": int(anio) if anio else None, "contaminante": n(contaminante), "zona": n(zona)})
        saludes_list = [{"descripcion": f[0]} for f in cursor.fetchall()]

        return jsonify({
            "anios": anios,
            "contaminantes": contaminantes_list,
            "zonas": zonas_list,
            "saludes": saludes_list
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: KPI SALUD PRINCIPAL
# =========================================================

@app.route("/api/salud")
def api_salud():
    anio = request.args.get("anio", "")
    contaminante = request.args.get("contaminante", "")
    zona = request.args.get("zona", "")
    salud = request.args.get("salud", "")

    def n(v):
        return v if v != "" else None

    conexion = None
    cursor = None

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                p.Year_Inicio,
                z.Nombre,
                c.Nombre,
                NVL(s.Descripcion, 'Sin indicador'),
                ROUND(AVG(r.Valor_Promedio), 2),
                COUNT(*),
                RANK() OVER(
                    PARTITION BY p.Year_Inicio
                    ORDER BY AVG(r.Valor_Promedio) DESC
                ),
                z.Latitud,
                z.Longitud
            FROM REGISTRO r
            INNER JOIN PERIODO p ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN ZONA z ON r.Id_Zona = z.Id_Zona
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            LEFT JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE (:anio IS NULL OR p.Year_Inicio = :anio)
              AND (:contaminante IS NULL OR c.Nombre = :contaminante)
              AND (:zona IS NULL OR z.Nombre = :zona)
              AND (:salud IS NULL OR s.Descripcion = :salud)
            GROUP BY p.Year_Inicio, z.Nombre, c.Nombre, s.Descripcion, z.Latitud, z.Longitud
            ORDER BY p.Year_Inicio, 5 DESC
        """, {
            "anio": int(anio) if anio else None,
            "contaminante": n(contaminante),
            "zona": n(zona),
            "salud": n(salud)
        })

        filas = cursor.fetchall()
        datos = []
        promedios = []

        for f in filas:
            prom = float(f[4]) if f[4] is not None else 0
            promedios.append(prom)
            datos.append({
                "anio": f[0],
                "zona": f[1],
                "contaminante": f[2],
                "indicador": f[3],
                "promedio": prom,
                "total_registros": f[5],
                "ranking": f[6],
                "latitud": float(f[7]) if f[7] is not None else None,
                "longitud": float(f[8]) if f[8] is not None else None
            })

        total_muertes_rel = sum(1 for d in datos if "muerte" in d["indicador"].lower())
        total_hosp = sum(1 for d in datos if "hospital" in d["indicador"].lower())
        zona_mayor_impacto = datos[0]["zona"] if datos else "Sin datos"
        contaminante_mayor = datos[0]["contaminante"] if datos else "Sin datos"

        # Gráfica barras por contaminante
        contam_agrupado = {}
        for d in datos:
            k = d["contaminante"]
            if k not in contam_agrupado:
                contam_agrupado[k] = []
            contam_agrupado[k].append(d["promedio"])

        grafica_barras = {
            "labels": list(contam_agrupado.keys()),
            "valores": [round(sum(v) / len(v), 2) for v in contam_agrupado.values()]
        }

        # Gráfica línea por año
        anio_agrupado = {}
        for d in datos:
            k = str(d["anio"])
            if k not in anio_agrupado:
                anio_agrupado[k] = []
            anio_agrupado[k].append(d["promedio"])

        grafica_linea = {
            "labels": sorted(anio_agrupado.keys()),
            "valores": [round(sum(anio_agrupado[a]) / len(anio_agrupado[a]), 2)
                        for a in sorted(anio_agrupado.keys())]
        }

        return jsonify({
            "total_registros": len(datos),
            "zona_mayor_impacto": zona_mayor_impacto,
            "contaminante_mayor": contaminante_mayor,
            "total_muertes_rel": total_muertes_rel,
            "total_hosp": total_hosp,
            "tabla": datos,
            "grafica_barras": grafica_barras,
            "grafica_linea": grafica_linea
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: CONTAMINANTES Y MUERTES
# =========================================================

@app.route("/api/muertes")
def api_muertes():
    conexion = None
    cursor = None
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                c.Nombre AS Contaminante,
                s.Descripcion AS Indicador_Salud,
                ROUND(AVG(r.Valor_Promedio), 2) AS Promedio_Contaminacion,
                COUNT(*) AS Total_Registros,
                RANK() OVER(
                    PARTITION BY s.Descripcion
                    ORDER BY AVG(r.Valor_Promedio) DESC
                ) AS Ranking
            FROM REGISTRO r
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            INNER JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE s.Descripcion LIKE '%Muertes%'
            GROUP BY c.Nombre, s.Descripcion
            ORDER BY s.Descripcion, 5
        """)

        filas = cursor.fetchall()
        datos = [
            {
                "contaminante": f[0],
                "indicador": f[1],
                "promedio": float(f[2]) if f[2] else 0,
                "total_registros": f[3],
                "ranking": f[4]
            }
            for f in filas
        ]

        grafica = {
            "labels": [d["contaminante"] for d in datos],
            "valores": [d["promedio"] for d in datos]
        }

        return jsonify({"datos": datos, "grafica": grafica})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: IMPACTO POR CONTAMINANTE
# =========================================================

@app.route("/api/impacto")
def api_impacto():
    conexion = None
    cursor = None
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                c.Nombre,
                ROUND(AVG(r.Valor_Promedio), 2),
                COUNT(r.Id_Registro),
                CASE
                    WHEN AVG(r.Valor_Promedio) <= 20 THEN 'Bajo'
                    WHEN AVG(r.Valor_Promedio) <= 40 THEN 'Medio'
                    ELSE 'Alto'
                END
            FROM REGISTRO r
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            GROUP BY c.Nombre
            ORDER BY AVG(r.Valor_Promedio) DESC
        """)

        filas = cursor.fetchall()
        datos = [
            {
                "contaminante": f[0],
                "promedio": float(f[1]) if f[1] else 0,
                "total_registros": f[2],
                "nivel_riesgo": f[3]
            }
            for f in filas
        ]

        grafica = {
            "labels": [d["contaminante"] for d in datos],
            "valores": [d["promedio"] for d in datos]
        }

        return jsonify({"datos": datos, "grafica": grafica})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: TENDENCIA HOSPITALIZACIONES
# =========================================================

@app.route("/api/tendencia_hospitalizaciones")
def api_tendencia_hospitalizaciones():
    salud = request.args.get("salud", "")
    conexion = None
    cursor = None

    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute("""
            SELECT
                p.Year_Inicio,
                c.Nombre,
                s.Descripcion,
                ROUND(AVG(r.Valor_Promedio), 2)
            FROM REGISTRO r
            INNER JOIN PERIODO p ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN INDICADOR_AMBIENTAL ia ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c ON ia.Id_Contaminante = c.Id_Contaminante
            INNER JOIN IDENTIFICADOR_SALUD s ON ia.Id_Salud = s.Id_Salud
            WHERE (:salud IS NULL OR s.Descripcion = :salud)
            GROUP BY p.Year_Inicio, c.Nombre, s.Descripcion
            ORDER BY p.Year_Inicio
        """, {"salud": salud if salud != "" else None})

        filas = cursor.fetchall()

        anios_unicos = sorted(list(set(f[0] for f in filas)))
        datasets = {}

        for fila in filas:
            anio = fila[0]
            contaminante = fila[1]
            promedio = float(fila[3]) if fila[3] else 0
            if contaminante not in datasets:
                datasets[contaminante] = {}
            datasets[contaminante][anio] = promedio

        colores = ["#00d4ff", "#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40"]
        datasets_chart = []

        for i, (contaminante, valores) in enumerate(datasets.items()):
            data = [valores.get(a, None) for a in anios_unicos]
            datasets_chart.append({
                "label": contaminante,
                "data": data,
                "borderColor": colores[i % len(colores)],
                "backgroundColor": colores[i % len(colores)],
                "borderWidth": 3,
                "tension": 0.3,
                "fill": False
            })

        return jsonify({
            "anios": anios_unicos,
            "datasets": datasets_chart
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: INDICADORES DE SALUD DISPONIBLES (para select tendencia)
# =========================================================

@app.route("/api/indicadores_salud")
def api_indicadores_salud():
    conexion = None
    cursor = None
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()

        # Solo indicadores que tienen registros reales
        cursor.execute("""
            SELECT DISTINCT s.Descripcion
            FROM IDENTIFICADOR_SALUD s
            INNER JOIN INDICADOR_AMBIENTAL ia ON ia.Id_Salud = s.Id_Salud
            INNER JOIN REGISTRO r ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            WHERE s.Descripcion IS NOT NULL
            ORDER BY s.Descripcion
        """)

        datos = [{"descripcion": f[0]} for f in cursor.fetchall()]
        return jsonify({"indicadores": datos})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


# =========================================================
# API: MAPA DE CALOR — SALUD
# =========================================================

@app.route("/api/mapa_calor_salud")
def api_mapa_calor_salud():
    contaminante = request.args.get("contaminante", "")
    anio         = request.args.get("anio", "")

    def n(v):
        return v if v != "" else None

    conexion = None
    cursor   = None

    try:
        conexion = obtener_conexion()
        cursor   = conexion.cursor()

        cursor.execute("""
            SELECT
                p.Year_Inicio          AS Año,
                c.Nombre               AS Contaminante,
                z.Nombre               AS Zona,
                ROUND(AVG(r.Valor_Promedio), 2) AS Promedio_Contaminacion,
                z.Latitud,
                z.Longitud,
                RANK() OVER (
                    PARTITION BY p.Year_Inicio
                    ORDER BY AVG(r.Valor_Promedio) DESC
                ) AS Ranking
            FROM REGISTRO r
            INNER JOIN PERIODO p
                ON r.Id_Periodo = p.Id_Periodo
            INNER JOIN ZONA z
                ON r.Id_Zona = z.Id_Zona
            INNER JOIN INDICADOR_AMBIENTAL ia
                ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            INNER JOIN CONTAMINANTE c
                ON ia.Id_Contaminante = c.Id_Contaminante
            LEFT JOIN IDENTIFICADOR_SALUD s
                ON ia.Id_Salud = s.Id_Salud
            WHERE (:contaminante IS NULL OR c.Nombre = :contaminante)
              AND (:anio IS NULL OR p.Year_Inicio = :anio)
              AND z.Latitud  IS NOT NULL
              AND z.Longitud IS NOT NULL
            GROUP BY
                p.Year_Inicio,
                c.Nombre,
                z.Nombre,
                z.Latitud,
                z.Longitud
            ORDER BY Promedio_Contaminacion DESC
        """, {
            "contaminante": n(contaminante),
            "anio": int(anio) if anio else None
        })

        filas = cursor.fetchall()
        datos = [
            {
                "anio":      f[0],
                "contaminante": f[1],
                "zona":      f[2],
                "promedio":  float(f[3]) if f[3] is not None else 0,
                "latitud":   float(f[4]) if f[4] is not None else None,
                "longitud":  float(f[5]) if f[5] is not None else None,
                "ranking":   f[6]
            }
            for f in filas
        ]

        return jsonify({"datos": datos})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:   cursor.close()
        if conexion: conexion.close()


# =========================================================
# API: MAPA DE CALOR — CALIDAD DEL AIRE
# =========================================================

@app.route("/api/mapa_calor_aire")
def api_mapa_calor_aire():
    id_contaminante = request.args.get("id_contaminante", "")
    anio            = request.args.get("anio", "")
    tipo_zona       = request.args.get("tipo_zona", "")

    conexion = None
    cursor   = None

    try:
        conexion = obtener_conexion()
        cursor   = conexion.cursor()

        if not tipo_zona:
            cursor.execute("SELECT Codigo FROM TIPO_ZONA WHERE ROWNUM = 1")
            tipo_zona = cursor.fetchone()[0]

        if not anio:
            cursor.execute("SELECT MIN(Year_Inicio) FROM PERIODO WHERE Year_Inicio IS NOT NULL")
            anio = cursor.fetchone()[0]

        if not id_contaminante:
            cursor.execute("SELECT Id_Contaminante FROM CONTAMINANTE WHERE ROWNUM = 1")
            id_contaminante = cursor.fetchone()[0]

        anio            = int(anio)
        id_contaminante = int(id_contaminante)

        cursor.execute("""
            SELECT
                z.Nombre               AS Zona,
                c.Nombre               AS Contaminante,
                ROUND(AVG(r.Valor_Promedio), 2) AS Promedio,
                z.Latitud,
                z.Longitud,
                RANK() OVER (
                    ORDER BY AVG(r.Valor_Promedio) DESC
                ) AS Ranking
            FROM REGISTRO r
            LEFT JOIN ZONA z
                ON r.Id_Zona = z.Id_Zona
            LEFT JOIN TIPO_ZONA tz
                ON tz.Codigo = z.Codigo
            LEFT JOIN PERIODO p
                ON r.Id_Periodo = p.Id_Periodo
            LEFT JOIN INDICADOR_AMBIENTAL ia
                ON r.Id_Indicador_Ambiental = ia.Id_Indicador_Ambiental
            LEFT JOIN CONTAMINANTE c
                ON ia.Id_Contaminante = c.Id_Contaminante
            WHERE tz.Codigo          = :tipo_zona
              AND p.Year_Inicio       = :anio
              AND c.Id_Contaminante   = :id_contaminante
              AND z.Latitud  IS NOT NULL
              AND z.Longitud IS NOT NULL
            GROUP BY
                z.Nombre,
                c.Nombre,
                z.Latitud,
                z.Longitud
            ORDER BY Promedio DESC
        """, {
            "tipo_zona":       tipo_zona,
            "anio":            anio,
            "id_contaminante": id_contaminante
        })

        filas = cursor.fetchall()
        datos = []
        for f in filas:
            promedio = float(f[2]) if f[2] is not None else 0
            escala = clasificar_ica(promedio)
            datos.append({
                "zona":        f[0],
                "contaminante": f[1],
                "promedio":    promedio,
                "latitud":     float(f[3]) if f[3] is not None else None,
                "longitud":    float(f[4]) if f[4] is not None else None,
                "ranking":     f[5],
                "estatus":     escala["categoria"],
                "color":       escala["color"],
                "clase":       escala["clase"]
            })

        return jsonify({"datos": datos})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if cursor:   cursor.close()
        if conexion: conexion.close()


if __name__ == "__main__":
    app.run(debug=True)

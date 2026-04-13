# Показывает структуру бд, и выводит первые 5 заполненных строк

import psycopg2
from tabulate import tabulate

# ===========================
# 🔹 Настройки подключения к базе данных
# ===========================
DB_HOST = "localhost"      # Адрес сервера базы данных
DB_PORT = 5432             # Порт PostgreSQL
DB_NAME = "StudyFlow"      # Название базы данных
DB_USER = "postgres"       # Имя пользователя
DB_PASSWORD = "123"        # Пароль пользователя

# ===========================
# 🔹 Установка соединения с базой данных
# ===========================
conn = psycopg2.connect(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

# Создаем курсор для выполнения SQL-запросов
cur = conn.cursor()

# ===========================
# 🔹 Получение списка всех таблиц в схеме public
# ===========================
cur.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type='BASE TABLE';
""")

# Извлекаем имена таблиц в виде списка
tables = [row[0] for row in cur.fetchall()]

# ===========================
# 🔹 Обход всех таблиц и вывод их структуры и данных
# ===========================
for table_name in tables:
    print(f"\n Таблица: {table_name}\n")

    # ---------------------------
    # 🔹 Получение списка колонок таблицы
    # ---------------------------
    cur.execute(f"""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    columns = [row[0] for row in cur.fetchall()]

    # ---------------------------
    # 🔹 Получение первых 5 строк таблицы
    # ---------------------------
    cur.execute(f"SELECT * FROM {table_name} LIMIT 5")
    rows = cur.fetchall()

    # ---------------------------
    # 🔹 Форматирование и вывод таблицы с помощью tabulate
    # ---------------------------
    print(tabulate(rows, headers=columns, tablefmt="fancy_grid", showindex=False))

cur.close()
conn.close()
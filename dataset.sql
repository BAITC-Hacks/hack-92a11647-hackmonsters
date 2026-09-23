BEGIN;

CREATE TABLE districts (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    population_share DOUBLE PRECISION NOT NULL CHECK (population_share > 0 AND population_share <= 1),
    t1 DOUBLE PRECISION NOT NULL CHECK (t1 BETWEEN 0 AND 100),
    t2 DOUBLE PRECISION NOT NULL CHECK (t2 BETWEEN 0 AND 100),
    e1 DOUBLE PRECISION NOT NULL CHECK (e1 BETWEEN 0 AND 100),
    e2 DOUBLE PRECISION NOT NULL CHECK (e2 BETWEEN 0 AND 100),
    s1 DOUBLE PRECISION NOT NULL CHECK (s1 BETWEEN 0 AND 100),
    s2 DOUBLE PRECISION NOT NULL CHECK (s2 BETWEEN 0 AND 100),
    b1 DOUBLE PRECISION NOT NULL CHECK (b1 BETWEEN 0 AND 100),
    b2 DOUBLE PRECISION NOT NULL CHECK (b2 BETWEEN 0 AND 100),
    c1 DOUBLE PRECISION NOT NULL CHECK (c1 BETWEEN 0 AND 100),
    c2 DOUBLE PRECISION NOT NULL CHECK (c2 BETWEEN 0 AND 100),
    base_d NUMERIC(5, 2) CHECK (base_d BETWEEN 0 AND 100)
);

CREATE TABLE measures (
    id VARCHAR(32) PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    measure_type VARCHAR(8) NOT NULL CHECK (measure_type IN ('District', 'City')),
    cost INT NOT NULL CHECK (cost >= 0),
    lag INT NOT NULL CHECK (lag BETWEEN 0 AND 8),
    effects JSONB NOT NULL CHECK (jsonb_typeof(effects) = 'object')
);

CREATE TABLE synergies (
    pair JSONB PRIMARY KEY CHECK (jsonb_typeof(pair) = 'array' AND jsonb_array_length(pair) = 2),
    bonus JSONB NOT NULL,
    target JSONB NOT NULL,
    lag_scaled BOOLEAN NOT NULL
);

CREATE TABLE conflicts (
    pair JSONB PRIMARY KEY CHECK (jsonb_typeof(pair) = 'array' AND jsonb_array_length(pair) = 2),
    scope VARCHAR(32) NOT NULL CHECK (scope IN ('global', 'same_district'))
);

CREATE TABLE scoring_rules (
    version VARCHAR(100) PRIMARY KEY,
    parameters JSONB NOT NULL
);

INSERT INTO districts (id, name, population_share, t1, t2, e1, e2, s1, s2, b1, b2, c1, c2, base_d) VALUES ('esil', 'Есиль', 0.27, 45.0, 62.0, 68.0, 72.0, 48.0, 55.0, 78.0, 60.0, 75.0, 70.0, 62.99);

INSERT INTO districts (id, name, population_share, t1, t2, e1, e2, s1, s2, b1, b2, c1, c2, base_d) VALUES ('almaty', 'Алматы', 0.24, 40.0, 75.0, 50.0, 55.0, 60.0, 65.0, 62.0, 52.0, 50.0, 60.0, 57.06);

INSERT INTO districts (id, name, population_share, t1, t2, e1, e2, s1, s2, b1, b2, c1, c2, base_d) VALUES ('saryarka', 'Сарыарка', 0.2, 50.0, 70.0, 42.0, 40.0, 62.0, 68.0, 58.0, 55.0, 45.0, 55.0, 54.65);

INSERT INTO districts (id, name, population_share, t1, t2, e1, e2, s1, s2, b1, b2, c1, c2, base_d) VALUES ('baikonur', 'Байконур', 0.13, 52.0, 68.0, 55.0, 50.0, 58.0, 60.0, 52.0, 58.0, 55.0, 58.0, 56.63);

INSERT INTO districts (id, name, population_share, t1, t2, e1, e2, s1, s2, b1, b2, c1, c2, base_d) VALUES ('nura', 'Нура', 0.16, 55.0, 40.0, 45.0, 65.0, 38.0, 35.0, 55.0, 50.0, 60.0, 50.0, 49.18);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M1', 'Транспорт', 'Выделенные полосы для автобусов', 'District', 18, 2, '{"T1": 6.0, "T2": 9.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M2', 'Транспорт', 'Умные светофоры (адаптивное управление)', 'City', 22, 2, '{"T1": 4.0, "B2": 3.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M3', 'Транспорт', 'Линия ЛРТ / расширение', 'District', 30, 4, '{"T1": 16.0, "T2": 20.0, "E2": 4.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M4', 'Экология', 'Парк / сквер', 'District', 15, 2, '{"E1": 12.0, "E2": 3.0, "B1": 2.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M5', 'Экология', 'Перевод частного сектора на чистое топливо', 'District', 25, 3, '{"E2": 14.0, "C1": 4.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M6', 'Экология', 'Городская программа озеленения и ветрозащитных полос', 'City', 20, 4, '{"E1": 5.0, "E2": 3.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M7', 'Соцсфера', 'Школа + детсад (модульное строительство)', 'District', 24, 3, '{"S1": 16.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M8', 'Соцсфера', 'Центр семейного здоровья / поликлиника', 'District', 20, 3, '{"S2": 14.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M9', 'Соцсфера', 'Дворовые спорт-хабы', 'District', 10, 1, '{"S1": 3.0, "S2": 3.0, "B1": 3.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M10', 'Безопасность', 'Освещение и камеры (расширение Safe City)', 'District', 12, 1, '{"B1": 12.0, "B2": 2.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M11', 'Безопасность', 'Безопасные переходы и школьные зоны', 'District', 10, 1, '{"B2": 12.0, "T1": -2.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M12', 'Сервисы', 'Единая цифровая платформа обращений', 'City', 14, 1, '{"C2": 5.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M13', 'Сервисы', 'Модернизация тепло- и водосетей', 'District', 28, 4, '{"C1": 18.0, "E2": 2.0}'::jsonb);

INSERT INTO measures (id, category, name, measure_type, cost, lag, effects) VALUES ('M14', 'Сервисы', 'Аварийные бригады ЖКХ + раннее оповещение', 'City', 16, 1, '{"C1": 5.0, "C2": 2.0}'::jsonb);

INSERT INTO synergies (pair, bonus, target, lag_scaled) VALUES ('["M1", "M2"]'::jsonb, '{"T1": 2.0}'::jsonb, '{"scope": "district_of_measure", "measure_id": "M1"}'::jsonb, FALSE);

INSERT INTO synergies (pair, bonus, target, lag_scaled) VALUES ('["M10", "M12"]'::jsonb, '{"B1": 2.0}'::jsonb, '{"scope": "district_of_measure", "measure_id": "M10"}'::jsonb, FALSE);

INSERT INTO synergies (pair, bonus, target, lag_scaled) VALUES ('["M5", "M6"]'::jsonb, '{"E2": 2.0}'::jsonb, '{"scope": "district_of_measure", "measure_id": "M5"}'::jsonb, FALSE);

INSERT INTO conflicts (pair, scope) VALUES ('["M1", "M3"]'::jsonb, 'global');

INSERT INTO conflicts (pair, scope) VALUES ('["M4", "M7"]'::jsonb, 'same_district');

INSERT INTO conflicts (pair, scope) VALUES ('["M5", "M13"]'::jsonb, 'same_district');

INSERT INTO scoring_rules (version, parameters) VALUES ('hackalem-district-dataset-v1', '{"version": "hackalem-district-dataset-v1", "status": "confirmed", "horizon_periods": 8, "period_unit": "квартал", "metric_weights": {"T1": 0.1, "T2": 0.1, "E1": 0.09, "E2": 0.11, "S1": 0.11, "S2": 0.11, "B1": 0.09, "B2": 0.09, "C1": 0.1, "C2": 0.1}, "critical_penalty": 1.0, "city_average_weight": 0.7, "weakest_district_weight": 0.3}'::jsonb);

COMMIT;

CREATE
 TABLE districts (    id
 VARCHAR(32) PRIMARY KEY,    na
me VARCHAR(100) NOT NULL UNIQUE,    po
pulation_share FLOAT NOT NULL CHECK (population_share > 0 AND population_share <= 1),    t1
 INT NOT NULL CHECK (t1 BETWEEN 0 AND 100),    t2
 INT NOT NULL CHECK (t2 BETWEEN 0 AND 100),    e1
 INT NOT NULL CHECK (e1 BETWEEN 0 AND 100),    e2
 INT NOT NULL CHECK (e2 BETWEEN 0 AND 100),    s1
 INT NOT NULL CHECK (s1 BETWEEN 0 AND 100),    s2
 INT NOT NULL CHECK (s2 BETWEEN 0 AND 100),    b1
 INT NOT NULL CHECK (b1 BETWEEN 0 AND 100),    b2
 INT NOT NULL CHECK (b2 BETWEEN 0 AND 100),    c1
 INT NOT NULL CHECK (c1 BETWEEN 0 AND 100),    c2
 INT NOT NULL CHECK (c2 BETWEEN 0 AND 100),    ba
se_d NUMERIC(5, 2) NOT NULL CHECK (base_d BETWEEN 0 AND 100));CREA
TE

 TABLE measures (    id
 VARCHAR(3) PRIMARY KEY,    ca
tegory VARCHAR(32) NOT NULL,    na
me VARCHAR(255) NOT NULL,    me
asure_type VARCHAR(8) NOT NULL CHECK (measure_type IN ('District', 'City')),    co
st INT NOT NULL CHECK (cost >= 0),    la
g INT NOT NULL CHECK (lag BETWEEN 0 AND 8),    ef
fects JSONB NOT NULL CHECK (jsonb_typeof(effects) = 'object'));INSE
RT

 INTO districts (    id
,    na
me,    po
pulation_share,    t1
,    t2
,    e1
,    e2
,    s1
,    s2
,    b1
,    b2
,    c1
,    c2
,    ba
se_d)VALUE
S
    ('
esil', 'Есиль', 0.27, 45, 62, 68, 72, 48, 55, 78, 60, 75, 70, 62.99),    ('
almaty', 'Алматы', 0.24, 40, 75, 50, 55, 60, 65, 62, 52, 50, 60, 57.06),    ('
saryarka', 'Сарыарка', 0.20, 50, 70, 42, 40, 62, 68, 58, 55, 45, 55, 54.65),    ('
baikonur', 'Байконур', 0.13, 52, 68, 55, 50, 58, 60, 52, 58, 55, 58, 56.63),    ('
nura', 'Нура', 0.16, 55, 40, 45, 65, 38, 35, 55, 50, 60, 50, 49.18);INSERT

 INTO measures (    id
,    ca
tegory,    na
me,    me
asure_type,    co
st,    la
g,    ef
fects)VALUE
S
    ( 
     
  'M1',      
  'Транспорт',      
  'Выделенные полосы для автобусов',      
  'District',      
  18,      
  2,      
  '{"T1": 6, "T2": 9}'::jsonb    ),
    ( 
     
  'M2',      
  'Транспорт',      
  'Умные светофоры (адаптивное управление)',      
  'City',      
  22,      
  2,      
  '{"T1": 4, "B2": 3}'::jsonb    ),
    ( 
     
  'M3',      
  'Транспорт',      
  'Линия ЛРТ / расширение',      
  'District',      
  30,      
  4,      
  '{"T1": 16, "T2": 20, "E2": 4}'::jsonb    ),
    ( 
     
  'M4',      
  'Экология',      
  'Парк / сквер',      
  'District',      
  15,      
  2,      
  '{"E1": 12, "E2": 3, "B1": 2}'::jsonb    ),
    ( 
     
  'M5',      
  'Экология',      
  'Перевод частного сектора на чистое топливо',      
  'District',      
  25,      
  3,      
  '{"E2": 14, "C1": 4}'::jsonb    ),
    ( 
     
  'M6',      
  'Экология',      
  'Городская программа озеленения и ветрозащитных полос',      
  'City',      
  20,      
  4,      
  '{"E1": 5, "E2": 3}'::jsonb    ),
    ( 
     
  'M7',      
  'Соцсфера',      
  'Школа + детсад (модульное строительство)',      
  'District',      
  24,      
  3,      
  '{"S1": 16}'::jsonb    ),
    ( 
     
  'M8',      
  'Соцсфера',      
  'Центр семейного здоровья / поликлиника',      
  'District',      
  20,      
  3,      
  '{"S2": 14}'::jsonb    ),
    ( 
     
  'M9',      
  'Соцсфера',      
  'Дворовые спорт-хабы',      
  'District',      
  10,      
  1,      
  '{"S1": 3, "S2": 3, "B1": 3}'::jsonb    ),
    ( 
     
  'M10',      
  'Безопасность',      
  'Освещение и камеры (расширение Safe City)',      
  'District',      
  12,      
  1,      
  '{"B1": 12, "B2": 2}'::jsonb    ),
    ( 
     
  'M11',      
  'Безопасность',      
  'Безопасные переходы и школьные зоны',      
  'District',      
  10,      
  1,      
  '{"B2": 12, "T1": -2}'::jsonb    ),
    ( 
     
  'M12',      
  'Сервисы',      
  'Единая цифровая платформа обращений',      
  'City',      
  14,      
  1,      
  '{"C2": 5}'::jsonb    ),
    ( 
     
  'M13',      
  'Сервисы',      
  'Модернизация тепло- и водосетей',      
  'District',      
  28,      
  4,      
  '{"C1": 18, "E2": 2}'::jsonb    ),
    ( 
     
  'M14',      
  'Сервисы',
'Аварийные бригады ЖКХ + раннее оповещение',      
  'City',      
  16,      
  1,      
  '{"C1": 5, "C2": 2}'::jsonb    );
{  "di
str

icts": 
[
    {      "id":
 "esi
l",      "name": "Е
силь",      "populatio
n_share": 0.27,      "T1": 45, 
     "T2": 62, 
     "E1": 68, 
     "E2": 72, 
     "S1": 48, 
     "S2": 55, 
     "B1": 78, 
     "B2": 60, 
     "C1": 75, 
     "C2": 70, 
     "base_d": 
62.99    },    {     
 "id":
 "alm
aty",      "name": "А
лматы",      "populatio
n_share": 0.24,      "T1": 40, 
     "T2": 75, 
     "E1": 50, 
     "E2": 55, 
     "S1": 60, 
     "S2": 65, 
     "B1": 62, 
     "B2": 52, 
     "C1": 50, 
     "C2": 60, 
     "base_d": 
57.06    },    {     
 "id":
 "sar
yarka",      "name": "С
арыарка",      "populatio
n_share": 0.2,      "T1": 50, 
     "T2": 70, 
     "E1": 42, 
     "E2": 40, 
     "S1": 62, 
     "S2": 68, 
     "B1": 58, 
     "B2": 55, 
     "C1": 45, 
     "C2": 55, 
     "base_d": 
54.65    },    {     
 "id":
 "bai
konur",      "name": "Б
айконур",      "populatio
n_share": 0.13,      "T1": 52, 
     "T2": 68, 
     "E1": 55, 
     "E2": 50, 
     "S1": 58, 
     "S2": 60, 
     "B1": 52, 
     "B2": 58, 
     "C1": 55, 
     "C2": 58, 
     "base_d": 
56.63    },    {     
 "id":
 "nur
a",      "name": "Н
ура",      "populatio
n_share": 0.16,      "T1": 55, 
     "T2": 40, 
     "E1": 45, 
     "E2": 65, 
     "S1": 38, 
     "S2": 35, 
     "B1": 55, 
     "B2": 50, 
     "C1": 60, 
     "C2": 50, 
     "base_d": 
49.18    }  ],  "meas
ures"
: [ 
   {      "id":
 "M1"
,      "category"
: "Транспорт",      "name": "В
ыделенные полосы для автобусов",      "type": "D
istrict",      "cost": 18
,      "lag": 2, 
     "effects":
 {        "T1": 6,
        "T2": 9 
     }    },   
 {     
 "id":
 "M2"
,      "category"
: "Транспорт",      "name": "У
мные светофоры (адаптивное управление)",      "type": "C
ity",      "cost": 22
,      "lag": 2, 
     "effects":
 {        "T1": 4,
        "B2": 3 
     }    },   
 {     
 "id":
 "M3"
,      "category"
: "Транспорт",      "name": "Л
иния ЛРТ / расширение",      "type": "D
istrict",      "cost": 30
,      "lag": 4, 
     "effects":
 {        "T1": 16
,        "T2": 20
,        "E2": 4 
     }    },   
 {     
 "id":
 "M4"
,      "category"
: "Экология",      "name": "П
арк / сквер",      "type": "D
istrict",      "cost": 15
,      "lag": 2, 
     "effects":
 {        "E1": 12
,        "E2": 3,
        "B1": 2 
     }    },   
 {     
 "id":
 "M5"
,      "category"
: "Экология",      "name": "П
еревод частного сектора на чистое топливо",      "type": "D
istrict",      "cost": 25
,      "lag": 3, 
     "effects":
 {        "E2": 14
,        "C1": 4 
     }    },   
 {     
 "id":
 "M6"
,      "category"
: "Экология",      "name": "Г
ородская программа озеленения и ветрозащитных полос",      "type": "C
ity",      "cost": 20
,      "lag": 4, 
     "effects":
 {        "E1": 5,
        "E2": 3 
     }    },   
 {     
 "id":
 "M7"
,      "category"
: "Соцсфера",      "name": "Ш
кола + детсад (модульное строительство)",      "type": "D
istrict",      "cost": 24
,      "lag": 3, 
     "effects":
 {        "S1": 16
      }    },   
 {     
 "id":
 "M8"
,      "category"
: "Соцсфера",      "name": "Ц
ентр семейного здоровья / поликлиника",      "type": "D
istrict",      "cost": 20
,      "lag": 3, 
     "effects":
 {        "S2": 14
      }    },   
 {     
 "id":
 "M9"
,      "category"
: "Соцсфера",      "name": "Д
воровые спорт-хабы",      "type": "D
istrict",      "cost": 10
,      "lag": 1, 
     "effects":
 {        "S1": 3,
        "S2": 3,
        "B1": 3 
     }    },   
 {     
 "id":
 "M10
",      "category"
: "Безопасность",      "name": "О
свещение и камеры (расширение Safe City)",      "type": "D
istrict",      "cost": 12
,      "lag": 1, 
     "effects":
 {        "B1": 12
,        "B2": 2 
     }    },   
 {     
 "id":
 "M11
",      "category"
: "Безопасность",      "name": "Б
езопасные переходы и школьные зоны",      "type": "D
istrict",      "cost": 10
,      "lag": 1, 
     "effects":
 {        "B2": 12
,
"T1": -2
      }    },   
 {     
 "id":
 "M12
",      "category"
: "Сервисы",      "name": "Е
диная цифровая платформа обращений",      "type": "C
ity",      "cost": 14
,      "lag": 1, 
     "effects":
 {        "C2": 5 
     }    },   
 {     
 "id":
 "M13
",      "category"
: "Сервисы",      "name": "М
одернизация тепло- и водосетей",      "type": "D
istrict",      "cost": 28
,      "lag": 4, 
     "effects":
 {        "C1": 18
,        "E2": 2 
     }    },   
 {     
 "id":
 "M14
",      "category"
: "Сервисы",      "name": "А
варийные бригады ЖКХ + раннее оповещение",      "type": "C
ity",      "cost": 16
,      "lag": 1, 
     "effects":
 {        "C1": 5,
        "C2": 2 
     }    }  ],
  "syne
rgies
": [
    {      "pair
": [ 
       "M1",   
     "M2"    
  ],      "b
onus": {
        "T1": 2 
     },      "t
arget": 
{        "scope":
 "district_of_measure",        "measure
_id": "M1"      },      "l
ag_scale
d": false    },    {     
 "pair
": [ 
       "M10",  
      "M12"   
   ],      "b
onus": {
        "B1": 2 
     },      "t
arget": 
{        "scope":
 "district_of_measure",        "measure
_id": "M10"      },      "l
ag_scale
d": false    },    {     
 "pair
": [ 
       "M5",   
     "M6"    
  ],      "b
onus": {
        "E2": 2 
     },      "t
arget": 
{        "scope":
 "district_of_measure",        "measure
_id": "M5"      },      "l
ag_scale
d": false    }  ],  "conf
licts
": [
    {      "pair
": [ 
       "M1",   
     "M3"    
  ],      "s
cope": "
global"    },    {     
 "pair
": [ 
       "M4",   
     "M7"    
  ],      "s
cope": "
same_district"    },    {     
 "pair
": [ 
       "M5",   
     "M13"   
   ],      "s
cope": "
same_district"    }  ]}

# Migraciones adicionales

Estas son migraciones INCREMENTALES sobre el esquema real (01_schema.sql).
Son seguras de correr más de una vez (usan IF NOT EXISTS) y no borran datos.

## Cómo aplicarlas en Supabase

Ve a tu proyecto → SQL Editor → New query, pega el contenido de cada
archivo en orden y dale Run.

## Cómo aplicarlas localmente

```bash
psql -d smartparking -f 02_add_geolocation.sql
```

## Lista de migraciones

- `02_add_geolocation.sql` — agrega `latitude`/`longitude` a `establishments`,
  necesario para el mapa geográfico del frontend (Leaflet).

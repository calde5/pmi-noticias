# Portfolio Monitoring Iberia · Noticias

Página informativa **no oficial** que recoge y resume noticias públicas de empresas de España y Portugal para el seguimiento de operaciones. No constituye asesoramiento.

- Web: https://calde5.github.io/pmi-noticias/
- Se actualiza automáticamente cada día hacia las 8:30 (hora peninsular).
- Todo el contenido está en `index.html`. Las noticias y los resúmenes van **cifrados** en el bloque `news-data` (AES-256-GCM con clave derivada de la contraseña mediante PBKDF2-SHA256) y solo se leen en el navegador tras introducir la contraseña.
- `tools/datos.mjs` extrae, valida y vuelve a cifrar ese bloque. La contraseña nunca se guarda en el repositorio: se pasa en la variable de entorno `PMI_PASS`.

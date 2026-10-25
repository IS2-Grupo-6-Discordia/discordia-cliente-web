# discordia-cliente-web
Aplicación web para clientes de Discordia

## Servicios dormidos en Render

En el plan gratuito, Render duerme los servicios tras 15 minutos sin tráfico y **no los despierta
si la request viene de otro servicio de Render** (el gateway): responde `429` con
`x-render-routing: hibernate-rate-limited`. Por eso, al abrir la app, el navegador le pega directo
al health check de cada backend (`api/wake.ts`), que sí los despierta, y el login espera a que
respondan mostrando "Estamos despertando el servidor".

- Si `EXPO_PUBLIC_API_URL` apunta a Render, se usan las URLs de producción de autenticación y
  servidores.
- `EXPO_PUBLIC_WAKE_URLS` (opcional) reemplaza esa lista: URLs separadas por coma. Definida vacía,
  desactiva el despertador. Cuando un servicio nuevo pase a depender del gateway, hay que agregar
  su health check acá.

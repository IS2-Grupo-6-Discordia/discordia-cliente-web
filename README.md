# discordia-cliente-web
Aplicación web para clientes de Discordia

## Servicios dormidos en Render

En el plan gratuito, Render duerme los servicios tras 15 minutos sin tráfico y **no los despierta
si la request viene de otro servicio de Render** (el gateway): responde `429` con
`x-render-routing: hibernate-rate-limited`. Por eso, al abrir la app, el navegador le pega directo
al health check de cada backend (`api/wake.ts`), que sí los despierta, y el login espera a que
respondan mostrando "Estamos despertando el servidor".

- Si `EXPO_PUBLIC_API_URL` apunta a Render, se usan las URLs de producción de autenticación,
  servidores y voz.
- `EXPO_PUBLIC_WAKE_URLS` (opcional) reemplaza esa lista: URLs separadas por coma. Definida vacía,
  desactiva el despertador. Cuando un servicio nuevo pase a depender del gateway, hay que agregar
  su health check acá.

## APK de Android (voz nativa)

Expo Go no trae el módulo nativo de WebRTC que usa LiveKit, así que la app se compila con
[EAS Build](https://docs.expo.dev/build/introduction/) (en la nube; no hace falta Android SDK). La
voz nativa vive en `lib/voiceRoom.ts` (`@livekit/react-native`); en web se usa `lib/voiceRoom.web.ts`.
La cámara se pide recién al activarla. Como sus permisos nativos están definidos en `app.json`, cualquier
cambio de esos textos o permisos requiere generar una APK nueva; una actualización JavaScript no alcanza.

```bash
npx eas-cli login                                     # una vez, con una cuenta de Expo
npx eas-cli build -p android --profile apk            # APK instalable, contra producción
npx eas-cli build -p android --profile development    # development build para desarrollar con hot reload
```

- Los perfiles están en `eas.json`. `EXPO_PUBLIC_API_URL` se fija **al compilar** (en `env` de cada
  perfil): cambiarla exige otra build. Los `.env` locales no se suben a EAS.
- Con el perfil `development`, se instala la APK y después se corre `npx expo start --dev-client`.
- El login con Google funciona en web y en la APK. En web usa Google Identity Services; en Android,
  `@react-native-google-signin/google-signin` pidiendo el `idToken` con el client ID **web**
  (`webClientId`), que es el que valida el backend. Para que Android lo permita, en Google Cloud
  tiene que existir un cliente OAuth de tipo **Android** con el paquete `com.discordia.app` y el
  SHA-1 del keystore con el que EAS firma la APK (`npx eas-cli credentials -p android`). Sin ese
  cliente, el selector de cuenta falla con `DEVELOPER_ERROR` y la app muestra el aviso de Google
  no disponible. No funciona en Expo Go: hace falta una build de EAS.

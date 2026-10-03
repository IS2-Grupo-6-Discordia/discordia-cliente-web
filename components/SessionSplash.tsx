import { View, ActivityIndicator } from "react-native"

// Pantalla de carga que muestran los guards mientras el AuthContext rehidrata la
// sesión (isLoading). Evita que se redirija al login por un frame antes de que
// loadToken() termine de leer el token de AsyncStorage.
export default function SessionSplash() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A1620",
      }}
    >
      <ActivityIndicator color="#37D6C0" size="large" />
    </View>
  )
}

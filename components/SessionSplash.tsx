import { View, ActivityIndicator, Text } from "react-native"

// Pantalla de carga que muestran los guards mientras el AuthContext rehidrata la
// sesión (isLoading). Evita que se redirija al login por un frame antes de que
// loadToken() termine de leer el token de AsyncStorage.
export default function SessionSplash({ message }: { message?: string }) {
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
      {message ? (
        <Text
          style={{
            color: "#8DA8AC",
            fontSize: 13,
            marginTop: 14,
            textAlign: "center",
            maxWidth: 300,
            lineHeight: 19,
          }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  )
}

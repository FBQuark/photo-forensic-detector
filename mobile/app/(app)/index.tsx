import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const {user, session, signout} = useAuth()

  return (
    <SafeAreaView>
          <TouchableOpacity 
            style={styles.button} 
            onPress={signout}
            >
            <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
        <View style={styles.container}>
            {/* <TextCustom fontSize={22}>Protected Routex</TextCustom> */}
            {user && (<Text>Hello {user.name}!</Text>)}
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{
    paddingHorizontal:20,

  },
  headline:{
    paddingVertical:20
  },
    button: {
      backgroundColor: 'black',
      padding: 12,
      borderRadius: 6,
      alignItems: 'center',
      margin:20,
    },
    buttonText: {
      color: 'white',
      fontSize: 18,
    },
})
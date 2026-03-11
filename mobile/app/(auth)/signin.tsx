import { 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet 
} from "react-native";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext"
import { Link } from "expo-router";



export default function signin() {
  const { signin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    signin({email, password});
  };

  return (
    <View  style={styles.container}>
        <View>
          <Text style={styles.headline}>SignIn</Text>

          <Text>Email:</Text>
          <TextInput 
            placeholder='Enter your email...' 
            style={styles.input}
            placeholderTextColor={"black"}
            value={email}
            onChangeText={(text) => setEmail(text)}
            />

          <Text>Password:</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={"black"}
            value={password}
            onChangeText={(text) => setPassword(text)}
            secureTextEntry
            />

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

            <View style={styles.footer}>
              <Text>Don't have an account? </Text>
              <Link href="/signup" style={styles.link}>
                Sign up →
              </Link>
            </View>

          </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: 'white'
  },
  headline:{
    textAlign:'center',
    marginTop:-100,
    marginBottom:50,
    fontWeight:"700",
    fontStyle:'italic'
  },
  input:{
    borderWidth:1,
    borderRadius:10, 
    padding:10,
    marginTop:10,
    marginBottom:10,
    borderColor:"black",
    backgroundColor:"white",
    color:"black"
  },
  button: {
    backgroundColor: 'black',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop:10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
  },
  footer:{
    flexDirection:"row",
    justifyContent:"center",
    marginTop:20
  },
  link:{
    color:"blue"
  }
});

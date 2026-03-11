import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function signup() {
  const { signup } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    try {
      await signup({ fullName, email, password });
      router.replace("/signin");
    } catch (error) {
      console.log("Signup failed:", error);
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.headline}>Sign Up</Text>

        <Text>First Name:</Text>
        <TextInput
          placeholder="Enter your first name..."
          placeholderTextColor="black"
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text>Last Name:</Text>
        <TextInput
          placeholder="Enter your last name..."
          placeholderTextColor="black"
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
        />

        <Text>Email:</Text>
        <TextInput
          placeholder="Enter your email..."
          placeholderTextColor="black"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text>Password:</Text>
        <TextInput
          placeholder="Enter your password..."
          placeholderTextColor="black"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Create Account</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text>Already have an account? </Text>
          <Link href="/signin" style={styles.link}>
            Sign in →
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "white",
  },
  headline: {
    textAlign: "center",
    marginTop: -100,
    marginBottom: 50,
    fontWeight: "700",
    fontStyle: "italic",
    fontSize: 24,
    color: "black",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
    borderColor: "black",
    backgroundColor: "white",
    color: "black",
  },
  button: {
    backgroundColor: "black",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  link: {
    color: "blue",
  },
});
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
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
      
      <View style={styles.formArea}>
        
        <View style={styles.brandingBar}>
          
          <Text style={styles.brandTitle}>Photo Forensic Detector</Text>
          <Text style={styles.brandTagline}>
            Detect suspicious information in images.
          </Text>
        </View>
        <View style={styles.imageRow}>
          
          <Image
            source={require("../../assets/images/actualimgs/camera.png")}
            style={styles.brandImage}
          />
          <Image
            source={require("../../assets/images/actualimgs/magnifying-glass.png")}
            style={styles.brandImage}
          />
        </View>
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
    backgroundColor: "white",
  },
  brandingBar: {
    backgroundColor: "#364153",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 12,
    marginHorizontal: -20,
    marginTop: -20,
  },
  brandTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  brandTagline: {
    color: "#9ca3af",
    fontSize: 13,
    textAlign: "center",
  },
  imageRow: {
    flexDirection: "row",
    gap: 80,
    marginTop: 50,
    marginBottom: 50,
    justifyContent: "center",
  },
  brandImage: {
    width: 56,
    height: 56,
    resizeMode: "contain",
  },
  formArea: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  headline: {
    textAlign: "center",

    marginBottom: 24,
    fontWeight: "700",
    fontStyle: "italic",
    fontSize: 22,
    color: "#364153",
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
    backgroundColor: "#364153",
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
    color: "#364153",
  },
});

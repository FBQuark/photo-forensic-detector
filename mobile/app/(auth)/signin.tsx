import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "expo-router";

export default function signin() {
  const { signin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    signin({ email, password });
  };

  return (
    <View style={styles.container}>
      <View style={styles.formArea}>
        {" "}
        <View style={styles.brandingBar}>
          {" "}
          <Text style={styles.brandTitle}>Photo Forensic Detector</Text>{" "}
          <Text style={styles.brandTagline}>
            Detect suspicious information in images.
          </Text>{" "}
        </View>
        <View style={styles.imageRow}>
          {" "}
          <Image
            source={require("../../assets/images/actualimgs/camera.png")}
            style={styles.brandImage}
          />{" "}
          <Image
            source={require("../../assets/images/actualimgs/magnifying-glass.png")}
            style={styles.brandImage}
          />{" "}
        </View>
        <Text style={styles.headline}>Sign In</Text>
        <Text>Email:</Text>
        <TextInput
          placeholder="Enter your email..."
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
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
        <View style={styles.footer}>
          <Text>Don&apos;t have an account? </Text>
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
    fontSize: 20,
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
  link: { color: "#364153" },
});

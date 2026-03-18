import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const { user, session, signout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Photo Forensic Detector</Text>
      </View>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          Welcome, upload your files below to scan for suspiscious data.
        </Text>
      </View>
      <TouchableOpacity style={styles.uploadButton}>
        <Text style={styles.uploadButtonText}>Upload Image</Text>
      </TouchableOpacity>
      <View style={styles.footer}>
        {user && <Text style={styles.greeting}>Logged in as {user.name}.</Text>}
        <TouchableOpacity style={styles.logoutButton} onPress={signout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    backgroundColor: "#364153",
    paddingVertical: 16,
    alignItems: "center",
  },
  headerText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  welcomeSection: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    color: "#364153",
  },
  uploadButton: {
    backgroundColor: "#2563eb" /* blue button for now*/,
    marginHorizontal: 80,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  greeting: {
    fontSize: 16,
    color: "#555",
  },
  logoutButton: {
    backgroundColor: "#364153",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: "white",
    fontSize: 16,
  },
});

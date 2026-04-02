import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

export default function Index() {
  const { user, signout } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  
  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setMessage("Permission required");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });

    if (result.canceled) {
      setMessage("No images selected");
      return;
    }

    setSelectedPhotos(result.assets.slice(0, 10));
    setMessage(`${result.assets.length} selected`);
  };

  
  const uploadImages = async () => {
    if (selectedPhotos.length === 0) {
      setMessage("Select images first");
      return;
    }

    setMessage("Uploading...");
    const collectedResults: any[] = [];

    for (const photo of selectedPhotos) {
      const formData = new FormData();

      formData.append("file", {
        uri: photo.uri,
        name: photo.fileName || "image.jpg",
        type: photo.mimeType || "image/jpeg",
      } as any);

      const res = await axios.post(
        `${API_URL}/upload-image`, formData
      );

      collectedResults.push(res.data);
    }

    setResults(collectedResults);
    setMessage("Done");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Photo Forensic Detector</Text>
        </View>

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Upload images from your camera roll
          </Text>
        </View>

        <TouchableOpacity style={styles.uploadButton} onPress={pickImages}>
          <Text style={styles.uploadButtonText}>Select Images</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={uploadImages}>
          <Text style={styles.uploadButtonText}>Upload</Text>
        </TouchableOpacity>

        {message && (
          <Text style={{ textAlign: "center", marginTop: 10 }}>{message}</Text>
        )}

        {/* 🧾 RAW JSON OUTPUT */}
        {results.length > 0 && (
          <View style={{ padding: 20 }}>
            <Text selectable>
              {JSON.stringify(results, null, 2)}
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          {user && <Text style={styles.greeting}>Logged in as {user.name}.</Text>}
          <TouchableOpacity style={styles.logoutButton} onPress={signout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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

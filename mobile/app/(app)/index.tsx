

import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ImagePickerAsset } from "expo-image-picker";
import { useState } from "react";
import { Platform } from "react-native";

import { useAuth } from "../../context/AuthContext";
// Photo Forensic Detector Frontend Screen
// Handles image selection, backend communication, and AI-based authenticity results display

// Backend response structure:
// Contains AI predictions, EXIF metadata, authenticity verdict, and error handling

type BackendResult = {
  success?: boolean;
  error?: string;
  verdict?: string;
  confidence?: string;
  forgery_score?: number;
  reason?: string;
  predicted?: {
    iso?: number;
    f_stop?: number;
    shutter?: string;
    t_sec?: number;
    ev?: number;
  };
  truth?: {
    ISO?: number | string | null;
    F?: number | string | null;
    T?: number | string | null;
  };
  exif?: Record<string, any>;
};

// Stores each image URI along with its corresponding backend result
type ResultType = {
  uri: string;
  result: BackendResult;
};

const REQUEST_TIMEOUT_MS = 30000;
const HEALTH_TIMEOUT_MS = 15000;

export default function Index() {
  const { user, signout } = useAuth();

  // State management:
// images → selected images from gallery
// results → backend analysis results
// loading → upload/processing indicator
// progress → upload status per image
// expanded → toggle detailed result view
// statusMessage → global status display

  const [images, setImages] = useState<ImagePickerAsset[]>([]);
  const [results, setResults] = useState<ResultType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string>("");


  // Backend configuration:
// Uses localhost for web and local IP for mobile devices (same Wi-Fi required)
  const SERVER_IP = "192.168.86.21";

  const BACKEND_URL =
    Platform.OS === "web"
      ? "http://127.0.0.1:8000/upload"
      : `http://${SERVER_IP}:8000/upload`;

  const HEALTH_URL =
    Platform.OS === "web"
      ? "http://127.0.0.1:8000/health"
      : `http://${SERVER_IP}:8000/health`;

      // Utility function to prevent hanging requests:
// Adds timeout control to all network calls
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit = {},
    timeoutMs: number = REQUEST_TIMEOUT_MS
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Health check before upload:
// Ensures backend is reachable and avoids unnecessary failures
  const testBackend = async (): Promise<boolean> => {
    try {
      setStatusMessage("Checking backend...");
      console.log("Checking backend health:", HEALTH_URL);

      const res = await fetchWithTimeout(
        HEALTH_URL,
        {
          method: "GET",
          cache: "no-store",
        },
        HEALTH_TIMEOUT_MS
      );

      console.log("Health response status:", res.status);

      if (!res.ok) {
        const text = await res.text();
        console.log("Health check failed:", text);
        setStatusMessage("Backend health check failed");
        return false;
      }

      const data = await res.json();
      console.log("Health OK:", data);
      setStatusMessage("Backend connected");
      return true;
    } catch (e: any) {
      console.log("Health fail:", e?.message || e);
      setStatusMessage("Backend unreachable");
      return false;
    }
  };
  // Image selection handler:
// Requests permissions, allows multi-image selection,
// initializes upload state, and verifies backend connectivity

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission required", "Allow access to photos.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        allowsMultipleSelection: true,
        quality: 1,
        exif: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      console.log("Selected images:", res.assets.length);

      const initialProgress: Record<string, string> = {};
      for (const asset of res.assets) {
        initialProgress[asset.uri] = "Queued";
      }

      setImages(res.assets);
      setResults([]);
      setExpanded({});
      setProgress(initialProgress);

      const backendOk = await testBackend();

      if (!backendOk) {
        setProgress((prev) => {
          const next = { ...prev };
          for (const asset of res.assets) {
            next[asset.uri] = "Backend unreachable";
          }
          return next;
        });

        Alert.alert(
          "Backend not reachable",
          `Could not reach:\n${HEALTH_URL}\n\nCheck:\n• FastAPI is running\n• backend started with --host 0.0.0.0\n• laptop and phone are on same Wi-Fi\n• firewall allows port 8000\n• this IP is correct: ${SERVER_IP}`
        );
        return;
      }
// Upload all images sequentially:
// Updates UI after each upload and tracks success/failure
      await uploadImages(res.assets);
    } catch (err: any) {
      console.log("Pick image error:", err?.message || err);
      Alert.alert("Error", err?.message || "Failed to select images.");
    }
  };
  // Upload a single image:
// Handles FormData creation, platform differences (web/mobile),
// progress updates, and error handling

  const uploadSingleImage = async (
    img: ImagePickerAsset,
    index: number,
    total: number
  ): Promise<ResultType> => {
    try {
      console.log(`Starting upload ${index + 1}/${total}:`, img.uri);

      setProgress((prev) => ({
        ...prev,
        [img.uri]: "Preparing...",
      }));

      const formData = new FormData();
      const fileName =
        img.fileName ||
        `photo_${Date.now()}_${index}.${img.mimeType?.includes("png") ? "png" : "jpg"}`;

      if (Platform.OS === "web") {
        const blob = await (await fetch(img.uri)).blob();
        formData.append("file", blob, fileName);
      } else {
        formData.append(
          "file",
          {
            uri: img.uri,
            name: fileName,
            type: img.mimeType || "image/jpeg",
          } as any
        );
      }

      setProgress((prev) => ({
        ...prev,
        [img.uri]: "Uploading...",
      }));

      const response = await fetchWithTimeout(
        BACKEND_URL,
        {
          method: "POST",
          body: formData,
        },
        REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data: BackendResult = await response.json();

      console.log("Upload result:", data);
      console.log("Predicted:", data?.predicted);

      setProgress((prev) => ({
        ...prev,
        [img.uri]: "Done",
      }));

      return { uri: img.uri, result: data };
    } catch (err: any) {
      console.log("Upload error:", err?.message || err);

      let errorMessage = "Upload failed";

      if (err?.name === "AbortError") {
        errorMessage = "Request timed out. Backend took too long to respond.";
      } else if (
        typeof err?.message === "string" &&
        err.message.toLowerCase().includes("network request failed")
      ) {
        errorMessage =
          "Network request failed. Your phone may not be able to reach the backend server.";
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setProgress((prev) => ({
        ...prev,
        [img.uri]: "Failed",
      }));

      return {
        uri: img.uri,
        result: {
          success: false,
          error: errorMessage,
        },
      };
    }
  };
  // Upload all images sequentially:
// Updates UI after each upload and tracks success/failure
  const uploadImages = async (selectedImages: ImagePickerAsset[]) => {
    try {
      setLoading(true);
      setResults([]);
      setExpanded({});
      setStatusMessage("Uploading images...");

      const collectedResults: ResultType[] = [];

      for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];

        setProgress((prev) => ({
          ...prev,
          [img.uri]: `Uploading ${i + 1}/${selectedImages.length}...`,
        }));

        const singleResult = await uploadSingleImage(
          img,
          i,
          selectedImages.length
        );

        collectedResults.push(singleResult);
        setResults([...collectedResults]);
      }

      setStatusMessage("Upload complete");

      const failedCount = collectedResults.filter(
        (item) => item.result?.success === false || item.result?.error
      ).length;

      if (failedCount > 0) {
        Alert.alert(
          "Upload finished",
          `${selectedImages.length - failedCount} succeeded, ${failedCount} failed.`
        );
      }
    } catch (err: any) {
      console.log("uploadImages error:", err);
      setStatusMessage("Upload failed");
      Alert.alert(
        "Error",
        err?.message || "Something went wrong while uploading."
      );
    } finally {
      setLoading(false);
    }
  };
  // Reset UI state:
// Clears images, results, progress, and status messages
  const clearAll = () => {
    if (loading) return;

    setImages([]);
    setResults([]);
    setProgress({});
    setExpanded({});
    setStatusMessage("");
  };
               // Toggle detailed analysis view for each image card
  const toggleExpand = (index: number) => {
    setExpanded((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Map backend verdict to UI colors:
// REAL → green, SUSPICIOUS → yellow, FAKE → red, NO_EXIF → gray

  const getVerdictColor = (verdict?: string) => {
    if (verdict === "REAL") return "#10b981";
    if (verdict === "SUSPICIOUS") return "#f59e0b";
    if (verdict === "FAKE") return "#ef4444";
    if (verdict === "NO_EXIF") return "#6b7280";
    return "#6b7280";
  };

  // Main UI rendering:
// Displays header, upload controls, selected images,
// and forensic analysis results
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerText}>🔍 Photo Forensic Detector</Text>
        </View>

        <Text style={styles.subtitle}>
          Upload images to analyze authenticity using AI
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.uploadButton, loading && styles.disabledButton]}
            onPress={pickImage}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="white" />
                <Text style={styles.uploadButtonText}> Processing...</Text>
              </View>
            ) : (
              <Text style={styles.uploadButtonText}>📸 Select Images</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.clearButton, loading && styles.disabledButton]}
            onPress={clearAll}
            disabled={loading}
          >
            <Text style={styles.clearButtonText}>🗑 Clear</Text>
          </TouchableOpacity>
        </View>

        {!!statusMessage && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Selected Images ({images.length})
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {images.map((img, index) => (
                <View key={`${img.uri}-${index}`} style={styles.previewContainer}>
                  <Image
                    source={{ uri: img.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.progressText}>
                    {progress[img.uri] || "Waiting"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
         
        

        {results.map((item, index) => {  
          const analysis = item.result;

          return (
            <View key={`${item.uri}-${index}`} style={styles.card}>
              <Image
                source={{ uri: item.uri }}
                style={styles.resultImage}
                resizeMode="contain"
              />

              <Text style={styles.cardTitle}>Image {index + 1}</Text>

              {analysis?.predicted && (
                <View style={styles.predictionBox}>
                  <Text style={styles.predictionTitle}>Predicted Output</Text>
                  <Text>ISO: {analysis.predicted.iso ?? "N/A"}</Text>
                  <Text>F-stop: {analysis.predicted.f_stop ?? "N/A"}</Text>
                  <Text>Shutter: {analysis.predicted.shutter ?? "N/A"}</Text>
                  <Text>EV: {analysis.predicted.ev ?? "N/A"}</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => toggleExpand(index)}>
                <Text style={styles.expandText}>
                  {expanded[index] ? "Hide Details ▲" : "Show Details ▼"}
                </Text>
              </TouchableOpacity>

              {expanded[index] && analysis?.error && (
                <View style={styles.analysisBox}>
                  <Text style={styles.errorText}>Error: {analysis.error}</Text>
                </View>
              )}

              {expanded[index] &&
                analysis &&
                !analysis.error &&
                analysis.success !== false && (
                  <View style={styles.analysisBox}>
                    <View
                      style={[
                        styles.verdictBanner,
                        { backgroundColor: getVerdictColor(analysis.verdict) },
                      ]}
                    >
                      <Text style={styles.verdictText}>
                        {analysis.verdict || "UNKNOWN"}
                      </Text>
                    </View>

                    {analysis.verdict === "NO_EXIF" && (
                      <Text style={styles.warningText}>
                        ⚠️ No EXIF metadata found. This may be a screenshot,
                        edited export, or metadata-stripped image.
                      </Text>
                    )}

                    <Text style={styles.analysisTitle}>🧠 AI Confidence</Text>
                    <Text>Confidence: {analysis.confidence ?? "N/A"}</Text>
                    <Text>
                      Forgery Score: {analysis.forgery_score ?? "N/A"}
                    </Text>
                    <Text>Reason: {analysis.reason ?? "N/A"}</Text>

                    <Text style={styles.subTitle}>📸 Actual</Text>
                    <Text>ISO: {analysis.truth?.ISO ?? "N/A"}</Text>
                    <Text>F-stop: {analysis.truth?.F ?? "N/A"}</Text>
                    <Text>Shutter: {analysis.truth?.T ?? "N/A"}</Text>
                  </View>
                )}
            </View>
          );
        })}

      

        <View style={styles.footer}>
          <Text>Logged in as {user?.name}</Text>
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
    backgroundColor: "#f3f4f6",
  },

  scrollContent: {
    paddingBottom: 24,
  },

  header: {
    backgroundColor: "#111827",
    padding: 20,
    alignItems: "center",
  },

  headerText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },

  subtitle: {
    textAlign: "center",
    margin: 15,
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },

  uploadButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 10,
    minWidth: 150,
    alignItems: "center",
  },

  clearButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 10,
    minWidth: 110,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.65,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  uploadButtonText: {
    color: "white",
    fontWeight: "600",
  },

  clearButtonText: {
    color: "white",
    fontWeight: "600",
  },

  statusBox: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: "#e0f2fe",
    padding: 10,
    borderRadius: 8,
  },

  statusText: {
    color: "#0f172a",
    textAlign: "center",
    fontWeight: "500",
  },

  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },

  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },

  previewContainer: {
    marginRight: 12,
    alignItems: "center",
    width: 130,
  },

  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: "#d1d5db",
  },

  progressText: {
    marginTop: 6,
    fontSize: 12,
    textAlign: "center",
  },

  card: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
  },

  resultImage: {
    width: "100%",
    height: 300,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },

  cardTitle: {
    fontWeight: "bold",
    marginTop: 10,
  },

  predictionBox: {
    marginTop: 10,
    backgroundColor: "#f0fdf4",
    padding: 12,
    borderRadius: 10,
  },

  predictionTitle: {
    fontWeight: "bold",
    marginBottom: 6,
  },

  expandText: {
    color: "#2563eb",
    marginTop: 10,
    fontWeight: "500",
  },

  analysisBox: {
    backgroundColor: "#eef2ff",
    padding: 15,
    marginTop: 10,
    borderRadius: 12,
  },

  verdictBanner: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },

  analysisTitle: {
    fontWeight: "bold",
    marginBottom: 5,
  },

  subTitle: {
    marginTop: 10,
    fontWeight: "bold",
  },

  verdictText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },

  warningText: {
    color: "#ef4444",
    marginBottom: 10,
  },

  errorText: {
    color: "#ef4444",
    fontWeight: "500",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
    marginTop: 10,
  },

  logoutButton: {
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 8,
  },

  logoutButtonText: {
    color: "white",
  },
});
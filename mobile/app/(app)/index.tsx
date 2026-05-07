import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import axios from "axios";
import { Buffer } from "buffer";
import { useAuth } from "@/context/AuthContext";
import { getBackendJWT } from "@/lib/appwrite";
import AnalysisResults from "../components/analysisResults";

global.Buffer = global.Buffer || Buffer;

type AnalysisResult = {
  filename: string;
  photoId?: string;
  analysis: {
    predicted?: {
      iso?: number;
      f_stop?: number;
      shutter_seconds?: number;
      shutter_display?: string;
      ev?: number;
    };
    truth?: {
      iso?: number;
      f_stop?: number;
      shutter_seconds?: number;
      shutter_display?: string;
      ev?: number;
    } | null;
    delta_ev?: number | null;
    verdict?: string;
    details?: {
      device_used?: string;
      model_input_size?: number;
      explanation?: string;
    };
  };
};

type SelectedPhoto = {
  uri: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
};

export default function Index() {
  const router = useRouter();
  const { user, signout } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  const [message, setMessage] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

  const resultsWithPreview = useMemo(() => {
    return results.map((result, index) => ({
      ...result,
      previewUri: selectedPhotos[index]?.uri || null,
    }));
  }, [results, selectedPhotos]);

  const formatValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  };

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
      case "REAL":
      case "CONSISTENT":
        return {
          backgroundColor: "#dcfce7",
          color: "#166534",
          borderColor: "#bbf7d0",
        };
      case "SUSPICIOUS":
        return {
          backgroundColor: "#fef3c7",
          color: "#92400e",
          borderColor: "#fde68a",
        };
      case "NO_EXIF":
        return {
          backgroundColor: "#e5e7eb",
          color: "#374151",
          borderColor: "#d1d5db",
        };
      default:
        return {
          backgroundColor: "#dbeafe",
          color: "#1d4ed8",
          borderColor: "#bfdbfe",
        };
    }
  };

  const handleSignout = async () => {
    try {
      await signout();
      setMessage("Logged out");
    } catch (error: any) {
      setMessage(error?.message || "Logout failed");
    }
  };

  const pickImages = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setMessage("Permission required");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 1,
      });

      if (result.canceled) {
        setMessage("No images selected");
        return;
      }

      const limitedAssets = result.assets.slice(0, 10).map((asset, index) => ({
        uri: asset.uri,
        fileName: asset.fileName || `image-${Date.now()}-${index}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        fileSize: asset.fileSize,
      }));

      setSelectedPhotos(limitedAssets);
      setResults([]);
      setMessage(`${limitedAssets.length} image file(s) selected`);
    } catch (error: any) {
      setMessage(error?.message || "Image selection failed");
    }
  };

  const handleClear = () => {
    setSelectedPhotos([]);
    setResults([]);
    setMessage("");
  };

  const uploadImages = async () => {
    if (!API_URL) {
      setMessage("API URL is missing");
      return;
    }

    if (selectedPhotos.length === 0) {
      setMessage("Please select at least one image first");
      return;
    }

    setIsSubmitting(true);
    setResults([]);
    setMessage("Processing...");

    try {
      const jwt = await getBackendJWT();

      const collectedResults: AnalysisResult[] = [];

      for (let i = 0; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        setMessage(`Processing ${i + 1} of ${selectedPhotos.length}...`);

        const formData = new FormData();
        formData.append("file", {
          uri: photo.uri,
          name: photo.fileName || "image.jpg",
          type: photo.mimeType || "image/jpeg",
        } as any);

        const res = await axios.post<AnalysisResult>(
          `${API_URL}/upload-image`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${jwt}`,
            },
            timeout: 120000,
          },
        );

        collectedResults.push(res.data);
      }

      setResults(collectedResults);
      setMessage(`Finished processing ${collectedResults.length} file(s)`);
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail || error?.message || "Upload failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!API_URL) {
      setMessage("API URL is missing");
      return;
    }

    if (results.length === 0) {
      setMessage("No results available to download");
      return;
    }

    setIsDownloadingCsv(true);
    setMessage("Preparing CSV...");

    try {
      const jwt = await getBackendJWT();

      const response = await axios.post(`${API_URL}/download-csv`, results, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 120000,
      });

      const base64 = Buffer.from(response.data).toString("base64");
      const fileUri = `${FileSystem.cacheDirectory}analysis_results.csv`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: "base64",
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setMessage("CSV created, but sharing is not available on this device");
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Share CSV Report",
        UTI: "public.comma-separated-values-text",
      });

      setMessage("CSV ready");
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          "CSV download failed",
      );
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!API_URL) {
      setMessage("API URL is missing");
      return;
    }

    if (results.length === 0) {
      setMessage("No results available to download");
      return;
    }

    setIsDownloadingPDF(true);
    setMessage("Preparing PDF...");

    try {
      const jwt = await getBackendJWT();

      const formData = new FormData();

      selectedPhotos.forEach((photo) => {
        formData.append("files", {
          uri: photo.uri,
          name: photo.fileName || "image.jpg",
          type: photo.mimeType || "image/jpeg",
        } as any);
      });

      formData.append("results", JSON.stringify(results));

      const response = await axios.post(`${API_URL}/download-pdf`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        responseType: "arraybuffer",
        timeout: 120000,
      });

      const base64 = Buffer.from(response.data).toString("base64");
      const fileUri = `${FileSystem.cacheDirectory}analysis_results.pdf`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: "base64",
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setMessage("PDF created, but sharing is not available on this device");
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Analysis Report",
        UTI: "com.adobe.pdf",
      });

      setMessage("PDF ready");
    } catch (error: any) {
      setMessage(
        error?.response?.data?.detail ||
          error?.message ||
          "PDF download failed",
      );
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Photo Forensic Detector</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.layout}>
          <View style={styles.leftPanel}>
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Upload files</Text>
              <Text style={styles.panelSubtitle}>
                Analyze image files for suspicious metadata.
              </Text>

              <View style={styles.userCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userCardLabel}>Signed in as</Text>
                  <Text style={styles.userCardName}>
                    {user?.name || "User"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleSignout}
                >
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={() => router.push("/history")}
                >
                  <Text style={styles.logoutButtonText}>History</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.dropArea} onPress={pickImages}>
                <Text style={styles.dropAreaTitle}>Select up to 10 images</Text>
                <Text style={styles.dropAreaSubtitle}>
                  Choose files from your camera roll
                </Text>
              </TouchableOpacity>

              {selectedPhotos.length > 0 && (
                <View style={styles.selectedFilesCard}>
                  <Text style={styles.selectedFilesTitle}>
                    Selected files: {selectedPhotos.length}
                  </Text>

                  {selectedPhotos.map((photo, index) => (
                    <View
                      key={`${photo.uri}-${index}`}
                      style={styles.selectedFileItem}
                    >
                      <Text style={styles.selectedFileName} numberOfLines={1}>
                        {photo.fileName || `image-${index + 1}.jpg`}
                      </Text>
                      <Text style={styles.selectedFileMeta}>
                        {photo.fileSize
                          ? `${photo.fileSize} bytes`
                          : "Image file"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.submitButton,
                    isSubmitting && styles.disabledButton,
                  ]}
                  onPress={uploadImages}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Submit Analysis</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.csvButton,
                    (isDownloadingCsv || results.length === 0) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleDownloadCsv}
                  disabled={isDownloadingCsv || results.length === 0}
                >
                  {isDownloadingCsv ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      Download Results as CSV
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.pdfButton,
                    (isDownloadingPDF || results.length === 0) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleDownloadPDF}
                  disabled={isDownloadingPDF || results.length === 0}
                >
                  {isDownloadingPDF ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      Download Results as PDF
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.clearButton,
                    (isSubmitting || isDownloadingPDF || isDownloadingCsv) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleClear}
                  disabled={
                    isSubmitting || isDownloadingPDF || isDownloadingCsv
                  }
                >
                  <Text style={styles.actionButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>

              {!!message && (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.rightPanel}>
            <AnalysisResults
              results={resultsWithPreview}
              formatValue={formatValue}
              getVerdictStyle={getVerdictStyle}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    backgroundColor: "#020617",
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  headerText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  layout: {
    gap: 16,
  },
  leftPanel: {},
  rightPanel: {
    gap: 16,
  },
  panelCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  panelTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
  },
  panelSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },
  userCard: {
    marginTop: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userCardLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  userCardName: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  logoutButton: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  dropArea: {
    marginTop: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  dropAreaTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
  },
  dropAreaSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  selectedFilesCard: {
    marginTop: 18,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  selectedFilesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
  },
  selectedFileItem: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  selectedFileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  selectedFileMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  buttonGroup: {
    marginTop: 18,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: "#16a34a",
  },
  csvButton: {
    backgroundColor: "#2563eb",
  },
  pdfButton: {
    backgroundColor: "#ef4444",
  },
  clearButton: {
    backgroundColor: "#64748b",
  },
  disabledButton: {
    opacity: 0.55,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  messageBox: {
    marginTop: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageText: {
    fontSize: 14,
    color: "#475569",
  },
});

// added preview images mapping with results
// added loading states (isSubmitting, isDownloadingPDF)
// improved image picker (limit, quality, metadata)
// added error handling for API + timeout
// added clear/reset functionality
// added PDF download feature with sharing
// removed CSV download logic
// improved UI layout (cards, panels, spacing)
// added verdict color styling (REAL, FAKE, etc.)
// structured result display (metrics + analysis sections)
// added activity indicators for buttons
// added selected files preview list
// improved message handling (status updates)
// added SafeArea + better scroll layout
// improved button states (disabled when loading)
// formatted values with fallback (N/A)
// added file metadata display (size, name)

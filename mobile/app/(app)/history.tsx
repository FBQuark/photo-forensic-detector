import React, { useEffect, useState, useRef } from "react";
import { Buffer } from "buffer";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import axios from "axios";
import { getBackendJWT } from "@/lib/appwrite";
import AnalysisResults, {
  type AnalysisResult,
} from "../components/analysisResults";
import { useRouter } from "expo-router";

type HistoryItem = AnalysisResult & {
  photoId: string;
  previewUri?: string | null;
};

global.Buffer = global.Buffer || Buffer;

export default function HistoryPage() {
  const API_URL = process.env.EXPO_PUBLIC_API_URL;
  const hasFetchedHistory = useRef(false);

  //History results returned in the backend
  const [results, setResults] = useState<HistoryItem[]>([]);
  const [message, setMessage] = useState("Loading history...");
  const [isLoading, setIsLoading] = useState(true);

  //selecting which to dowbload
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  //States for csv and pdf buttons
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const router = useRouter();

  //results selection
  const selectedResults =
    selectedIndexes.length > 0
      ? selectedIndexes.map((index) => results[index])
      : results;

  const toggleSelected = (index: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const selectAll = () => {
    setSelectedIndexes(results.map((_, index) => index));
  };

  const clearSelection = () => {
    setSelectedIndexes([]);
  };

  const formatValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  };

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
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

  const handleDownloadCsv = async () => {
    if (!API_URL) {
      setMessage("API URL is missing");
      return;
    }

    if (results.length === 0) {
      setMessage("No history results available to download");
      return;
    }

    setIsDownloadingCsv(true);
    setMessage("Preparing CSV...");

    try {
      const response = await axios.post(
        `${API_URL}/download-csv`,
        selectedResults,
        {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 120000,
        },
      );

      //Expo filesystem writes files as base64 strings
      // Convert csv response into base64
      const base64 = Buffer.from(response.data).toString("base64");
      const fileUri = `${FileSystem.cacheDirectory}${
        selectedIndexes.length > 0
          ? "selected_history_results.csv"
          : "history_results.csv"
      }`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: "base64",
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setMessage("CSV created, but sharing is not available on this device");
        return;
      }

      //open the "share" options  (gives you options like text, email, gmail, drive, etc)
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
      setMessage("No history results available to download");
      return;
    }

    setIsDownloadingPDF(true);
    setMessage("Preparing PDF...");

    try {
      const jwt = await getBackendJWT();

      const indexesToDownload =
        selectedIndexes.length > 0
          ? selectedIndexes
          : results.map((_, index) => index);

      //remove base64 string before sending to backend
      const resultsToDownload = indexesToDownload.map((index) => {
        const { previewUri, ...resultWithoutPreview } = results[index]; //takes preview uri out and saves the rest to resultwithoutpreview
        return resultWithoutPreview;
      });

      const formData = new FormData();

      for (const index of indexesToDownload) {
        const item = results[index];

        if (!item.photoId) continue;

        const imageRes = await axios.get(
          `${API_URL}/photo-preview/${item.photoId}`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
            responseType: "arraybuffer",
            timeout: 120000,
          },
        );

        const contentType = imageRes.headers["content-type"] || "image/jpeg";
        const base64 = Buffer.from(imageRes.data).toString("base64");
        //write the image to a temp file so it can be appended to the form data
        const fileUri = `${FileSystem.cacheDirectory}history-image-${index}.jpg`;

        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: "base64",
        });

        formData.append("files", {
          uri: fileUri,
          name: item.filename || `history-image-${index}.jpg`,
          type: contentType,
        } as any);
      }

      formData.append("results", JSON.stringify(resultsToDownload));

      const response = await axios.post(`${API_URL}/download-pdf`, formData, {
        responseType: "arraybuffer",
        timeout: 120000,
      });

      const pdfBase64 = Buffer.from(response.data).toString("base64");
      const pdfUri = `${FileSystem.cacheDirectory}${
        selectedIndexes.length > 0
          ? "selected_history_results.pdf"
          : "history_results.pdf"
      }`;

      await FileSystem.writeAsStringAsync(pdfUri, pdfBase64, {
        encoding: "base64",
      });

      const canShare = await Sharing.isAvailableAsync();

      if (!canShare) {
        setMessage("PDF created, but sharing is not available on this device");
        return;
      }

      //open sharing area to send via email, text, etc
      await Sharing.shareAsync(pdfUri, {
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

  useEffect(() => {
    const fetchHistory = async () => {
      if (!API_URL) {
        setMessage("API URL is missing");
        setIsLoading(false);
        return;
      }

      try {
        const jwt = await getBackendJWT();

        const historyRes = await axios.get<HistoryItem[]>(
          `${API_URL}/fetch-history`,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
            timeout: 120000,
          },
        );

        const historyData = historyRes.data;
        setMessage("Loading image previews...");

        const resultsWithPreviews = await Promise.all(
          historyData.map(async (item) => {
            if (!item.photoId) {
              return {
                ...item,
                previewUri: null,
              };
            }

            try {
              const imageRes = await axios.get(
                `${API_URL}/photo-preview/${item.photoId}`,
                {
                  headers: {
                    Authorization: `Bearer ${jwt}`,
                  },
                  responseType: "arraybuffer",
                  timeout: 120000,
                },
              );

              const contentType =
                imageRes.headers["content-type"] || "image/jpeg";

              const base64 = Buffer.from(imageRes.data).toString("base64");
              const previewUri = `data:${contentType};base64,${base64}`;

              return {
                ...item,
                previewUri,
              };
            } catch (error) {
              console.error("Failed to load preview:", item.photoId, error);
              return {
                ...item,
                previewUri: null,
              };
            }
          }),
        );

        setResults(resultsWithPreviews);
        setMessage("");
      } catch (error: any) {
        console.error("Failed to fetch history:", error);
        setMessage(
          error?.response?.data?.detail ||
            error?.message ||
            "Failed to load history",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (hasFetchedHistory.current) return;
    hasFetchedHistory.current = true;

    fetchHistory();
  }, [API_URL]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/")}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerText}>Analysis History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!!message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
            {isLoading && <ActivityIndicator style={{ marginTop: 10 }} />}
          </View>
        )}

        {results.length > 0 && (
          <View style={styles.actionCard}>
            <View>
              <Text style={styles.selectionTitle}>
                {selectedIndexes.length > 0
                  ? `${selectedIndexes.length} selected`
                  : "No items selected"}
              </Text>
              <Text style={styles.selectionSubtitle}>
                If none are selected, downloads include your full loaded
                history.
              </Text>
            </View>

            <View style={styles.historyButtonGroup}>
              <TouchableOpacity style={styles.smallButton} onPress={selectAll}>
                <Text style={styles.smallButtonText}>Select All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smallButton}
                onPress={clearSelection}
              >
                <Text style={styles.smallButtonText}>Clear Selection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  styles.csvButton,
                  isDownloadingCsv && styles.disabledButton,
                ]}
                onPress={handleDownloadCsv}
                disabled={isDownloadingCsv}
              >
                {isDownloadingCsv ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.downloadButtonText}>Download CSV</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  styles.pdfButton,
                  isDownloadingPDF && styles.disabledButton,
                ]}
                onPress={handleDownloadPDF}
                disabled={isDownloadingPDF}
              >
                {isDownloadingPDF ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.downloadButtonText}>Download PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <AnalysisResults
          results={results}
          formatValue={formatValue}
          getVerdictStyle={getVerdictStyle}
          selectedIndexes={selectedIndexes}
          onToggleSelected={toggleSelected}
        />
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
    gap: 16,
  },
  messageBox: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  messageText: {
    fontSize: 14,
    color: "#475569",
  },
  actionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 14,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  selectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  historyButtonGroup: {
    gap: 10,
  },
  smallButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  downloadButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  csvButton: {
    backgroundColor: "#2563eb",
  },
  pdfButton: {
    backgroundColor: "#ef4444",
  },
  disabledButton: {
    opacity: 0.55,
  },
  downloadButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  backButton: {
    position: "absolute",
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },

  backButtonText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
});

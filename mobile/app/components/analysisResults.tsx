import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { TouchableOpacity } from "react-native";

export type AnalysisResult = {
  filename: string;
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

type ResultWithPreview = AnalysisResult & {
  previewUri?: string | null;
};

type Props = {
  results: ResultWithPreview[];
  formatValue: (v: any) => string;
  getVerdictStyle: (v?: string) => {
    backgroundColor: string;
    color: string;
    borderColor: string;
  };
  selectedIndexes?: number[];
  onToggleSelected?: (index: number) => void;
};

export default function AnalysisResults({
  results,
  formatValue,
  getVerdictStyle,
  selectedIndexes = [],
  onToggleSelected,
}: Props) {
  if (results.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateTitle}>No results yet</Text>
        <Text style={styles.emptyStateText}>
          Upload files and submit them to see analysis results here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {results.map((result, index) => {
        const analysis = result.analysis || {};
        const predicted = analysis.predicted || {};
        const truth = analysis.truth;
        const verdict = analysis.verdict || "UNKNOWN";
        const verdictStyle = getVerdictStyle(verdict);
        const isSelected = selectedIndexes.includes(index);

        return (
          <View
            key={`${result.filename}-${index}`}
            style={[styles.resultCard, isSelected && styles.selectedResultCard]}
          >
            <View style={styles.resultTop}>
              <View style={styles.previewWrapper}>
                {result.previewUri ? (
                  <Image
                    source={{ uri: result.previewUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.noPreview}>
                    <Text style={styles.noPreviewText}>
                      No preview available
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.resultMain}>
                <View style={styles.resultHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultFileName}>{result.filename}</Text>
                    <Text style={styles.resultSubText}>
                      Model input size:{" "}
                      {formatValue(analysis.details?.model_input_size)}
                    </Text>
                  </View>

                  <View style={styles.resultActions}>
                    {onToggleSelected && (
                      <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => onToggleSelected(index)}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxSelected,
                          ]}
                        >
                          {isSelected && (
                            <Text style={styles.checkboxCheck}>✓</Text>
                          )}
                        </View>
                        <Text style={styles.checkboxText}>Select</Text>
                      </TouchableOpacity>
                    )}

                    <View
                      style={[
                        styles.verdictBadge,
                        {
                          backgroundColor: verdictStyle.backgroundColor,
                          borderColor: verdictStyle.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.verdictBadgeText,
                          { color: verdictStyle.color },
                        ]}
                      >
                        {verdict}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metricGrid}>
                  <Metric
                    label="Predicted ISO"
                    value={formatValue(predicted.iso)}
                  />
                  <Metric
                    label="Predicted F-Stop"
                    value={formatValue(predicted.f_stop)}
                  />
                  <Metric
                    label="Predicted Shutter"
                    value={formatValue(predicted.shutter_display)}
                  />
                  <Metric
                    label="Predicted EV"
                    value={formatValue(predicted.ev)}
                  />
                </View>

                <View style={styles.infoSections}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Reference Data</Text>

                    {truth ? (
                      <View style={styles.infoList}>
                        <Text style={styles.infoText}>
                          <Text style={styles.infoStrong}>ISO: </Text>
                          {formatValue(truth.iso)}
                        </Text>
                        <Text style={styles.infoText}>
                          <Text style={styles.infoStrong}>F-Stop: </Text>
                          {formatValue(truth.f_stop)}
                        </Text>
                        <Text style={styles.infoText}>
                          <Text style={styles.infoStrong}>Shutter: </Text>
                          {formatValue(truth.shutter_display)}
                        </Text>
                        <Text style={styles.infoText}>
                          <Text style={styles.infoStrong}>EV: </Text>
                          {formatValue(truth.ev)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.infoMuted}>
                        No usable EXIF reference data found.
                      </Text>
                    )}
                  </View>

                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Analysis Summary</Text>

                    <View style={styles.infoList}>
                      <Text style={styles.infoText}>
                        <Text style={styles.infoStrong}>Delta EV: </Text>
                        {formatValue(analysis.delta_ev)}
                      </Text>
                      <Text style={styles.infoText}>
                        <Text style={styles.infoStrong}>Device: </Text>
                        {formatValue(analysis.details?.device_used)}
                      </Text>
                      <Text style={styles.infoText}>
                        <Text style={styles.infoStrong}>Explanation: </Text>
                        {formatValue(analysis.details?.explanation)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
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
  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    padding: 28,
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  resultTop: {
    gap: 16,
  },
  previewWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  previewImage: {
    width: "100%",
    height: 220,
  },
  noPreview: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  noPreviewText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  resultMain: {
    gap: 14,
  },
  resultHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  resultFileName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
  },
  resultSubText: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  verdictBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verdictBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "47%",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  },
  metricLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: "600",
  },
  metricValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  infoSections: {
    gap: 12,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 10,
  },
  infoList: {
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  infoStrong: {
    fontWeight: "700",
    color: "#1e293b",
  },
  infoMuted: {
    fontSize: 14,
    color: "#64748b",
  },
  selectedResultCard: {
    borderWidth: 2,
    borderColor: "#60a5fa",
  },

  resultActions: {
    alignItems: "flex-end",
    gap: 8,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  checkboxSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  checkboxCheck: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },

  checkboxText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
});

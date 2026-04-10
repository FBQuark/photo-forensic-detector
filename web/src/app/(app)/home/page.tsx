"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

type AnalysisResult = {
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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

export default function HomePage() {
  const { user, signout } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);

  const handleSignout = async () => {
    try {
      await signout();
      setMessage("Logged out");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Logout failed"));
    }
  };

  const isZipFile = (file: File) => {
    return (
      file.name.toLowerCase().endsWith(".zip") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed"
    );
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith("image/");
  };

  const clearPreviewUrls = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
  };

  const handleClear = () => {
    clearPreviewUrls();
    setSelectedFiles([]);
    setPreviewUrls([]);
    setResults([]);
    setMessage("");
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    clearPreviewUrls();

    if (!acceptedFiles || acceptedFiles.length === 0) {
      setSelectedFiles([]);
      setPreviewUrls([]);
      setResults([]);
      setMessage("No files selected");
      return;
    }

    const zipFiles = acceptedFiles.filter(isZipFile);
    const imageFiles = acceptedFiles.filter(isImageFile);

    if (zipFiles.length > 0) {
      if (acceptedFiles.length > 1) {
        setSelectedFiles([]);
        setPreviewUrls([]);
        setResults([]);
        setMessage("Please upload either one zip file or image files, not both.");
        return;
      }

      setSelectedFiles([zipFiles[0]]);
      setPreviewUrls([]);
      setResults([]);
      setMessage(`1 zip file selected: ${zipFiles[0].name}`);
      return;
    }

    const limitedFiles = imageFiles.slice(0, 10);
    const urls = limitedFiles.map((file) => URL.createObjectURL(file));

    setSelectedFiles(limitedFiles);
    setPreviewUrls(urls);
    setResults([]);
    setMessage(`${limitedFiles.length} image file(s) selected`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxFiles: 10,
    accept: {
      "image/*": [],
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
  });

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      setMessage("Please select at least one file first");
      return;
    }

    setIsSubmitting(true);
    setMessage("Processing...");
    setResults([]);

    try {
      const firstFile = selectedFiles[0];

      if (isZipFile(firstFile)) {
        const formData = new FormData();
        formData.append("file", firstFile);

        const res = await axios.post<AnalysisResult[]>(
          "http://127.0.0.1:8000/upload-zip",
          formData
        );

        setResults(res.data);
        setMessage("Finished processing zip file");
        return;
      }

      const collectedResults: AnalysisResult[] = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await axios.post<AnalysisResult>(
          "http://127.0.0.1:8000/upload-image",
          formData
        );
        collectedResults.push(res.data);
      }

      setResults(collectedResults);
      setMessage(`Finished processing ${collectedResults.length} file(s)`);
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Upload failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (results.length === 0) {
      setMessage("No results available to download");
      return;
    }

    setIsDownloadingCsv(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/download-csv", results, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "analysis_results.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      setMessage("CSV downloaded successfully");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "CSV download failed"));
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (results.length === 0) {
      setMessage("No results available to download");
      return;
    }

    setIsDownloadingPDF(true);

    try {
      const formData = new FormData();

      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      formData.append("results", JSON.stringify(results));

      const res = await axios.post("http://127.0.0.1:8000/download-pdf", formData, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "analysis_results.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);

      setMessage("PDF downloaded successfully");
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "PDF download failed"));
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const getVerdictClasses = (verdict?: string) => {
    switch (verdict) {
      case "REAL":
      case "CONSISTENT":
        return "bg-green-100 text-green-700 border-green-200";
      case "SUSPICIOUS":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "FAKE":
        return "bg-red-100 text-red-700 border-red-200";
      case "NO_EXIF":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const formatValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return "N/A";
    return value;
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="w-full bg-slate-950 py-5 shadow-sm">
        <h1 className="text-center text-white text-3xl font-bold">
          Photo Forensic Detector
        </h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow-md">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-800">
                Upload files
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Analyze image files or a single zip file for suspicious metadata.
              </p>
            </div>

            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-sm text-slate-500">Signed in as</p>
                <p className="font-medium text-slate-800">{user?.name || "User"}</p>
              </div>

              <button
                onClick={handleSignout}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Logout
              </button>
            </div>

            <div
              {...getRootProps()}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-slate-400"
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p className="text-slate-700">Drop the files here...</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-slate-800">
                    Drag and drop up to 10 images
                  </p>
                  <p className="text-sm text-slate-500">
                    You can also upload one zip file
                  </p>
                </div>
              )}
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Selected files: {selectedFiles.length}
                </p>

                <div className="space-y-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="rounded-lg bg-white p-3 shadow-sm">
                      <p className="text-sm font-medium text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">{file.size} bytes</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-500 disabled:bg-green-300"
              >
                {isSubmitting ? "Processing..." : "Submit Analysis"}
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={isDownloadingCsv || results.length === 0}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:bg-blue-300"
              >
                {isDownloadingCsv ? "Downloading CSV..." : "Download Results as CSV"}
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloadingPDF || results.length === 0}
                className="w-full rounded-xl bg-red-500 py-3 font-semibold text-white transition hover:bg-red-400 disabled:bg-red-300"
              >
                {isDownloadingPDF ? "Downloading PDF..." : "Download Results as PDF"}
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting || isDownloadingCsv || isDownloadingPDF}
                className="w-full rounded-xl bg-slate-500 py-3 font-semibold text-white transition hover:bg-slate-400 disabled:bg-slate-300"
              >
                Clear
              </button>
            </div>

            {message && (
              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {message}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h3 className="text-xl font-semibold text-slate-800">No results yet</h3>
                <p className="mt-2 text-slate-500">
                  Upload files and submit them to see analysis results here.
                </p>
              </div>
            ) : (
              results.map((result, index) => {
                const analysis = result.analysis || {};
                const predicted = analysis.predicted || {};
                const truth = analysis.truth;
                const verdict = analysis.verdict || "UNKNOWN";
                const preview = previewUrls[index];

                return (
                  <div
                    key={`${result.filename}-${index}`}
                    className="rounded-2xl bg-white p-6 shadow-md"
                  >
                    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                      <div>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {preview ? (
                            <img
                              src={preview}
                              alt={result.filename}
                              className="h-56 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                              No preview available
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">
                              {result.filename}
                            </h3>
                            <p className="text-sm text-slate-500">
                              Model input size: {formatValue(analysis.details?.model_input_size)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-4 py-1 text-sm font-semibold ${getVerdictClasses(
                              verdict
                            )}`}
                          >
                            {verdict}
                          </span>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Predicted ISO
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-800">
                              {formatValue(predicted.iso)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Predicted F-Stop
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-800">
                              {formatValue(predicted.f_stop)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Predicted Shutter
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-800">
                              {formatValue(predicted.shutter_display)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Predicted EV
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-800">
                              {formatValue(predicted.ev)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 p-4">
                            <h4 className="mb-3 font-semibold text-slate-800">Reference Data</h4>
                            {truth ? (
                              <div className="space-y-2 text-sm text-slate-600">
                                <p>
                                  <span className="font-medium text-slate-800">ISO:</span>{" "}
                                  {formatValue(truth.iso)}
                                </p>
                                <p>
                                  <span className="font-medium text-slate-800">F-Stop:</span>{" "}
                                  {formatValue(truth.f_stop)}
                                </p>
                                <p>
                                  <span className="font-medium text-slate-800">Shutter:</span>{" "}
                                  {formatValue(truth.shutter_display)}
                                </p>
                                <p>
                                  <span className="font-medium text-slate-800">EV:</span>{" "}
                                  {formatValue(truth.ev)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No usable EXIF reference data found.
                              </p>
                            )}
                          </div>

                          <div className="rounded-xl border border-slate-200 p-4">
                            <h4 className="mb-3 font-semibold text-slate-800">Analysis Summary</h4>
                            <div className="space-y-2 text-sm text-slate-600">
                              <p>
                                <span className="font-medium text-slate-800">Delta EV:</span>{" "}
                                {formatValue(analysis.delta_ev)}
                              </p>
                              <p>
                                <span className="font-medium text-slate-800">Device:</span>{" "}
                                {formatValue(analysis.details?.device_used)}
                              </p>
                              <p>
                                <span className="font-medium text-slate-800">Explanation:</span>{" "}
                                {formatValue(analysis.details?.explanation)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// added proper TypeScript type (removed any)

// added getErrorMessage() for better error handling

// added image preview (previewUrls + URL.createObjectURL)

// added cleanup for preview URLs (revokeObjectURL)

// added Clear button (reset state)

// added loading states (isDownloadingCSV / PDF)

// improved UI (split layout: upload + results)

// replaced raw JSON with structured result cards

// added verdict color styling (REAL / FAKE / etc)

// added formatValue() to avoid undefined/null issues

// improved file handling (limit 10, zip vs images)

// overall: upgraded from basic UI → full dashboard
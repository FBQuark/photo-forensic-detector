"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { getBackendJWT } from "@/lib/appwrite";
import { useRouter } from "next/navigation";
import axios from "axios";
import AnalysisResults, {
  type AnalysisResult,
} from "@/app/components/analysisResults";

type AnalysisResultWithPhotoId = AnalysisResult & {
  photoId?: string;
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
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { user, signout } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [previewBlobs, setPreviewBlobs] = useState<(Blob | null)[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [results, setResults] = useState<AnalysisResultWithPhotoId[]>([]);

  const router = useRouter();
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
    setPreviewBlobs([]);
    setResults([]);
    setMessage("");
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      clearPreviewUrls();
      setPreviewBlobs([]);

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
          setMessage(
            "Please upload either one zip file or image files, not both.",
          );
          return;
        }

        setSelectedFiles([zipFiles[0]]);
        setPreviewUrls([]);
        setPreviewBlobs([]);
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
    },
    [previewUrls],
  );

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

  const fetchBackendPreviews = async (
    items: AnalysisResultWithPhotoId[],
    jwt: string,
  ) => {
    if (!API_BASE_URL) {
      setMessage("Backend URL is not configured");
      return;
    }

    clearPreviewUrls();

    const blobs: (Blob | null)[] = [];

    const urls = await Promise.all(
      items.map(async (item, index) => {
        if (!item.photoId) {
          blobs[index] = null;
          return "";
        }

        try {
          const imageRes = await axios.get(
            `${API_BASE_URL}/photo-preview/${item.photoId}`,
            {
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
              responseType: "blob",
            },
          );

          blobs[index] = imageRes.data;
          return URL.createObjectURL(imageRes.data);
        } catch (error) {
          console.error("Failed to load preview:", item.photoId, error);
          blobs[index] = null;
          return "";
        }
      }),
    );

    setPreviewBlobs(blobs);
    setPreviewUrls(urls);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      setMessage("Please select at least one file first");
      return;
    }

    const jwt = await getBackendJWT();

    const authConfig = {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    };

    setIsSubmitting(true);
    setMessage("Processing...");
    clearPreviewUrls();
    setPreviewUrls([]);
    setPreviewBlobs([]);
    setResults([]);
    try {
      const firstFile = selectedFiles[0];

      if (isZipFile(firstFile)) {
        const formData = new FormData();
        formData.append("file", firstFile);

        const res = await axios.post<AnalysisResultWithPhotoId[]>(
          `${API_BASE_URL}/upload-zip`,
          formData,
          authConfig,
        );

        setResults(res.data);
        await fetchBackendPreviews(res.data, jwt);
        setMessage("Finished processing zip file");
        return;
      }

      const collectedResults: AnalysisResultWithPhotoId[] = [];

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await axios.post<AnalysisResultWithPhotoId>(
          `${API_BASE_URL}/upload-image`,
          formData,
          authConfig,
        );

        collectedResults.push(res.data);
      }

      setResults(collectedResults);
      await fetchBackendPreviews(collectedResults, jwt);
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
      const res = await axios.post(`${API_BASE_URL}/download-csv`, results, {
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

      const selectedImageFiles = selectedFiles.filter(isImageFile);

      if (selectedImageFiles.length > 0) {
        for (const file of selectedImageFiles) {
          formData.append("files", file);
        }
      } else {
        previewBlobs.forEach((blob, index) => {
          if (blob) {
            formData.append(
              "files",
              blob,
              results[index]?.filename || `analysis-image-${index}.jpg`,
            );
          }
        });
      }

      if (!formData.has("files")) {
        setMessage("No preview images available for PDF download");
        setIsDownloadingPDF(false);
        return;
      }

      formData.append("results", JSON.stringify(results));

      const res = await axios.post(`${API_BASE_URL}/download-pdf`, formData, {
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
                Analyze image files or a single zip file for suspicious
                metadata.
              </p>
            </div>

            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-sm text-slate-500">Signed in as</p>
                <p className="font-medium text-slate-800">
                  {user?.name || "User"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push("/history")}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  History
                </button>

                <button
                  onClick={handleSignout}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Logout
                </button>
              </div>
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
                    <div
                      key={index}
                      className="rounded-lg bg-white p-3 shadow-sm"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {file.size} bytes
                      </p>
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
                {isDownloadingCsv
                  ? "Downloading CSV..."
                  : "Download Results as CSV"}
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloadingPDF || results.length === 0}
                className="w-full rounded-xl bg-red-500 py-3 font-semibold text-white transition hover:bg-red-400 disabled:bg-red-300"
              >
                {isDownloadingPDF
                  ? "Downloading PDF..."
                  : "Download Results as PDF"}
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

          <AnalysisResults
            results={results}
            previewUrls={previewUrls}
            emptyTitle="No results yet"
            emptyMessage="Upload files and submit them to see analysis results here."
          />
        </div>
      </div>
    </div>
  );
}

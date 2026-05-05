"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getBackendJWT } from "@/lib/appwrite";
import AnalysisResults, {
  type AnalysisResult,
} from "@/app/components/analysisResults";

//A history entry has the same shape as a typical analysis result with the addition of a photoId to fetch the photo from the backend. given this history page doesnt display the userid
//is it not necessary in this instance
type HistoryItem = AnalysisResult & {
  photoId: string;
};

export default function HistoryPage() {
  const hasFetchedHistory = useRef(false);

  //History results being returned by the backend
  const [results, setResults] = useState<HistoryItem[]>([]);

  //browser object URLs used to display image previews
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  //Raw image blobs used when generating the pdf download
  const [previewBlobs, setPreviewBlobs] = useState<(Blob | null)[]>([]);

  //loading/error/success message state
  const [message, setMessage] = useState("Loading history...");

  //stores which cards are selected for download
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  //state for the csv and pdf downloads
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const router = useRouter();

  //if nothing is selected the entire results is exported otherwise only the ones that the user has selected
  const selectedResults =
    selectedIndexes.length > 0
      ? selectedIndexes.map((index) => results[index])
      : results;

  //slect or unselect a single history item
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

  //PDF and csv handling works the same way. it creates a temporary browser URL then clicks it, downloading it for you
  const handleDownloadCsv = async () => {
    if (results.length === 0) {
      setMessage("No history results available to download");
      return;
    }

    setIsDownloadingCsv(true);

    try {
      const res = await axios.post(
        "http://127.0.0.1:8000/download-csv",
        selectedResults,
        { responseType: "blob" },
      );

      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        selectedIndexes.length > 0
          ? "selected_history_results.csv"
          : "history_results.csv";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
      setMessage("CSV downloaded successfully");
    } catch (error) {
      console.error("CSV download failed:", error);
      setMessage("CSV download failed");
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (results.length === 0) {
      setMessage("No history results available to download");
      return;
    }

    setIsDownloadingPdf(true);

    try {
      const formData = new FormData();

      const indexesToDownload =
        selectedIndexes.length > 0
          ? selectedIndexes
          : results.map((_, index) => index);

      const resultsToDownload = indexesToDownload.map(
        (index) => results[index],
      );

      indexesToDownload.forEach((index) => {
        const blob = previewBlobs[index];
        const result = results[index];

        if (blob) {
          formData.append(
            "files",
            blob,
            result.filename || `history-image-${index}.jpg`,
          );
        }
      });

      formData.append("results", JSON.stringify(resultsToDownload));

      const res = await axios.post(
        "http://127.0.0.1:8000/download-pdf",
        formData,
        { responseType: "blob" },
      );

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        selectedIndexes.length > 0
          ? "selected_history_results.pdf"
          : "history_results.pdf";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
      setMessage("PDF downloaded successfully");
    } catch (error) {
      console.error("PDF download failed:", error);
      setMessage("PDF download failed");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  //Fetching the history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const jwt = await getBackendJWT();

        const historyRes = await axios.get<HistoryItem[]>(
          "http://127.0.0.1:8000/fetch-history",
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          },
        );

        const historyData = historyRes.data;
        setResults(historyData);
        setMessage("Loading image previews...");

        const blobs: (Blob | null)[] = [];

        const urls = await Promise.all(
          historyData.map(async (item, index) => {
            if (!item.photoId) {
              blobs[index] = null;
              return "";
            }
            //getting the image previews
            try {
              const imageRes = await axios.get(
                `http://127.0.0.1:8000/photo-preview/${item.photoId}`,
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
        setMessage("");
      } catch (error) {
        console.error("Failed to fetch history:", error);
        setMessage("Failed to load history");
      }
    };

    if (hasFetchedHistory.current) return;
    hasFetchedHistory.current = true;

    fetchHistory();
  }, []);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="w-full bg-slate-950 py-5 shadow-sm">
        <button
          onClick={() => router.push("/home")}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition"
        >
          Back
        </button>
        <h1 className="text-center text-white text-3xl font-bold">
          Analysis History
        </h1>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {message && (
          <div className="mb-6 rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            {message}
          </div>
        )}

        {results.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {selectedIndexes.length > 0
                    ? `${selectedIndexes.length} selected`
                    : "No items selected"}
                </p>
                <p className="text-sm text-slate-500">
                  If none are selected, downloads include your full loaded
                  history.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                >
                  Select All
                </button>

                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={isDownloadingCsv}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-blue-300"
                >
                  {isDownloadingCsv ? "Downloading CSV..." : "Download CSV"}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:bg-red-300"
                >
                  {isDownloadingPdf ? "Downloading PDF..." : "Download PDF"}
                </button>
              </div>
            </div>
          </div>
        )}

        <AnalysisResults
          results={results}
          previewUrls={previewUrls}
          selectedIndexes={selectedIndexes}
          onToggleSelected={toggleSelected}
          emptyTitle="No history yet"
          emptyMessage="Your previous image analysis results will appear here."
        />
      </main>
    </div>
  );
}

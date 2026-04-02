"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

export default function HomePage() {
  const { user, signout } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSignout = async () => {
    try {
      await signout();
      setMessage("Logged Out");
    } catch (error: any) {
      setMessage(error?.message || "Logout Failed");
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!acceptedFiles || acceptedFiles.length === 0) {
      setSelectedFiles([]);
      setMessage("No files selected");
      return;
    }

    const limitedFiles = acceptedFiles.slice(0, 10);

    setSelectedFiles(limitedFiles);
    setResults([]);
    setMessage(`${limitedFiles.length} file(s) selected`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxFiles: 10,
    accept: {
      "image/*": [],
    },
  });

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      setMessage("Please select at least one image first");
      return;
    }

    setIsSubmitting(true);
    setMessage("Processing...");
    setResults([]);

    const collectedResults: any[] = [];

    try {
      for (const file of selectedFiles) {
        const formData = new FormData(); // need to use formdata because json cant send files
        formData.append("file", file);

        const res = await axios.post(
          "http://127.0.0.1:8000/upload-image",
          formData
        );

        console.log("Response:", res.data);

        collectedResults.push({
          originalFileName: file.name,
          response: res.data,
        });
      }

      setResults(collectedResults);
      setMessage(`Finished processing ${collectedResults.length} file(s)`);
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {" "}
      {/* this makes it 2 levels*/}
      {/* Header bar */}
      <header className="w-full bg-gray-900 py-4">
        {" "}
        <h1 className="text-center text-white text-2xl font-bold">
          {" "}
          Photo Forensic Detector
        </h1>
      </header>
      <div className="flex flex-1 items-center justify-center px-4">
        {" "}
        <div className="w-full max-w-xl bg-white rounded-xl shadow-md p-8 space-y-6">
          {" "}
          <div className="text-center py-2">
            {" "}
            <h2 className="text-xl font-semibold text-gray-700">
              {" "}
              Welcome, upload your files below to scan for suspiscious data.
            </h2>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg text-gray-600">
              {" "}
              Logged in as {user?.name || "User"}.
            </p>

            <button
              onClick={handleSignout}
              className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
            >
              Logout
            </button>
          </div>
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-gray-400 transition-colors bg-gray-50"
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-gray-700">Drop the images here...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-800">
                  Drag and drop up to 10 images here
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse files
                </p>
              </div>
            )}
          </div>

          {selectedFiles.length > 0 && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
              <p>
                <b>Files selected:</b> {selectedFiles.length}
              </p>
              {selectedFiles.map((file, index) => (
                <div key={index} className="mt-2">
                  <p>
                    <b>File {index + 1}:</b> {file.name}
                  </p>
                  <p>
                    <b>Size:</b> {file.size} bytes
                  </p>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-500 transition-colors disabled:bg-green-300"
          >
            {isSubmitting ? "Processing..." : "Submit"}
          </button>

          {message && (
            <p className="text-sm text-center text-gray-600">{message}</p>
          )}

          {results.length > 0 && (
            <div className="rounded-md bg-black text-green-400 p-4 text-sm overflow-x-auto">
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";

export default function HomePage() {
  const { user, signout } = useAuth();

  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignout = async () => {
    try {
      await signout();
      setMessage("Logged Out");
    } catch (error: any) {
      setMessage(error?.message || "Logout Failed");
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0] || null;

    if (!file) {
      setSelectedFile(null);
      setMessage("No file selected");
      return;
    }

    setSelectedFile(file);
    setMessage(`Selected: ${file.name}`);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "image/*": [],
    },
  });

  const handleSubmit = async () => {
    if (!selectedFile) {
      setMessage("Please select an image first");
      return;
    }

    setIsSubmitting(true);
    setMessage("Processing...");

    try {
      const formData = new FormData(); //need to use formdata because json cant send files
      formData.append("file", selectedFile);

      const res = await axios.post(
        "http://127.0.0.1:8000/upload-image",
        formData,
      );

      console.log("Response:", res.data);

      setMessage(
        `Processed: ${res.data.filename} (${res.data.size_bytes} bytes)`,
      );
    } catch (error: any) {
      console.error(error);
      setMessage(error);
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
              <p className="text-gray-700">Drop the image here...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-800">
                  Drag and drop an image here
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse files
                </p>
              </div>
            )}
          </div>
          {selectedFile && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
              <p>
                <b>File:</b> {selectedFile.name}
              </p>
              <p>
                <b>Size:</b> {selectedFile.size} bytes
              </p>
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
        </div>
      </div>
    </div>
  );
}

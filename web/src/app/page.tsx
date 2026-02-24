"use client";

import { useState } from "react";

export default function Home() {
  const [data, setData] = useState<any>(null);

  const callApi = async () => {
    const res = await fetch("http://localhost:8000/");
    const json = await res.json();
    setData(json);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>Photo Forensic Detector</h1>
      <button onClick={callApi}>Call API</button>

      {data && (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
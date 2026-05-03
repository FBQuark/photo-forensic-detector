"use client";

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

type Props = {
  results: AnalysisResult[];
  previewUrls?: string[];
  emptyTitle?: string;
  emptyMessage?: string;
  selectedIndexes?: number[];
  onToggleSelected?: (index: number) => void;
};

export default function AnalysisResults({
  results,
  previewUrls = [],
  emptyTitle = "No results yet",
  emptyMessage = "Results will appear here.",
  selectedIndexes = [],
  onToggleSelected,
}: Props) {
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

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
        <h3 className="text-xl font-semibold text-slate-800">{emptyTitle}</h3>
        <p className="mt-2 text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {results.map((result, index) => {
        const analysis = result.analysis || {};
        const predicted = analysis.predicted || {};
        const truth = analysis.truth;
        const verdict = analysis.verdict || "UNKNOWN";
        const preview = previewUrls[index];
        const isSelected = selectedIndexes.includes(index);

        return (
          <div
            key={`${result.filename}-${index}`}
            className={`rounded-2xl bg-white p-6 shadow-md ${
              isSelected ? "ring-2 ring-blue-400" : ""
            }`}
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
                      Model input size:{" "}
                      {formatValue(analysis.details?.model_input_size)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {onToggleSelected && (
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelected(index)}
                          className="h-4 w-4"
                        />
                        Select
                      </label>
                    )}

                    <span
                      className={`rounded-full border px-4 py-1 text-sm font-semibold ${getVerdictClasses(
                        verdict
                      )}`}
                    >
                      {verdict}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <ResultBox
                    label="Predicted ISO"
                    value={formatValue(predicted.iso)}
                  />
                  <ResultBox
                    label="Predicted F-Stop"
                    value={formatValue(predicted.f_stop)}
                  />
                  <ResultBox
                    label="Predicted Shutter"
                    value={formatValue(predicted.shutter_display)}
                  />
                  <ResultBox
                    label="Predicted EV"
                    value={formatValue(predicted.ev)}
                  />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h4 className="mb-3 font-semibold text-slate-800">
                      Reference Data
                    </h4>

                    {truth ? (
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-800">
                            ISO:
                          </span>{" "}
                          {formatValue(truth.iso)}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">
                            F-Stop:
                          </span>{" "}
                          {formatValue(truth.f_stop)}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">
                            Shutter:
                          </span>{" "}
                          {formatValue(truth.shutter_display)}
                        </p>
                        <p>
                          <span className="font-medium text-slate-800">
                            EV:
                          </span>{" "}
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
                    <h4 className="mb-3 font-semibold text-slate-800">
                      Analysis Summary
                    </h4>

                    <div className="space-y-2 text-sm text-slate-600">
                      <p>
                        <span className="font-medium text-slate-800">
                          Delta EV:
                        </span>{" "}
                        {formatValue(analysis.delta_ev)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-800">
                          Device:
                        </span>{" "}
                        {formatValue(analysis.details?.device_used)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-800">
                          Explanation:
                        </span>{" "}
                        {formatValue(analysis.details?.explanation)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}
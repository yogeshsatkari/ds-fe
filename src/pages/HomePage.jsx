import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IMAGE_ACCEPT, MAX_IMAGES, USER_ID } from "../config.js";
import { editSummaryPath, extractToDocx } from "../api/dischargeApi.js";
import { useSession } from "../hooks/useSession.js";
import FileDropzone from "../components/FileDropzone.jsx";
import LoadingPanel from "../components/LoadingPanel.jsx";
import ErrorAlert from "../components/ErrorAlert.jsx";

export default function HomePage() {
  const navigate = useNavigate();
  const { session, update, reset } = useSession();
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddImages = (files) => {
    setImageFiles((prev) => [...prev, ...files].slice(0, MAX_IMAGES));
    setError(null);
  };

  const handleRemoveImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartOver = () => {
    reset();
    setImageFiles([]);
    setError(null);
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (!imageFiles.length) return;
    if (!USER_ID) {
      setError(
        "Missing user ID. Set VITE_PLACEHOLDER_USER_ID in your .env file.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await extractToDocx({
        files: imageFiles,
        patientId: session.patientId,
      });

      update({
        patientId: data.patientId,
        filename: data.filename,
      });

      navigate(editSummaryPath(USER_ID, data.patientId), {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Discharge Summary
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Upload clinical notes and labs to create a summary
              </p>
            </div>
            {session.patientId && (
              <button
                type="button"
                onClick={handleStartOver}
                disabled={loading}
                className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <section className="space-y-4">
          {!loading && (
            <FileDropzone
              accept={IMAGE_ACCEPT}
              multiple
              label="Add patient documents"
              hint={`JPG, PNG, or TIFF (up to ${MAX_IMAGES} images in free tier)`}
              disabled={loading || imageFiles.length >= MAX_IMAGES}
              onFiles={handleAddImages}
            />
          )}

          {imageFiles.length > 0 && !loading && (
            <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {imageFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-slate-600">
                    <span className="mr-2 font-mono text-xs text-slate-400">
                      {index + 1}.
                    </span>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}

          {loading && (
            <LoadingPanel
              title="Creating your summary…"
              message="This usually takes a few minutes. Keep this tab open."
            />
          )}

          <ErrorAlert message={error} onDismiss={() => setError(null)} />

          {!loading && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!imageFiles.length || loading}
              className="w-full rounded-md bg-clinical-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Generate summary
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IMAGE_ACCEPT, MAX_IMAGES, USER_ID } from '../config.js'
import {
  editSummaryPath,
  extractToDocx,
  fetchUserPatients,
} from '../api/dischargeApi.js'
import { useSession } from '../hooks/useSession.js'
import FileDropzone from '../components/FileDropzone.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import PastPatientsList from '../components/PastPatientsList.jsx'

export default function HomePage() {
  const navigate = useNavigate()
  const { update } = useSession()
  const [imageFiles, setImageFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [patients, setPatients] = useState([])
  const [patientsLoading, setPatientsLoading] = useState(Boolean(USER_ID))
  const [patientsError, setPatientsError] = useState(null)

  useEffect(() => {
    if (!USER_ID) {
      setPatients([])
      setPatientsLoading(false)
      return
    }

    let cancelled = false

    async function loadPatients() {
      setPatientsLoading(true)
      setPatientsError(null)
      try {
        const list = await fetchUserPatients(USER_ID)
        if (!cancelled) {
          setPatients(list)
        }
      } catch (err) {
        if (!cancelled) {
          setPatients([])
          setPatientsError(err instanceof Error ? err.message : 'Failed to load patients')
        }
      } finally {
        if (!cancelled) {
          setPatientsLoading(false)
        }
      }
    }

    loadPatients()

    return () => {
      cancelled = true
    }
  }, [])

  const handleAddImages = (files) => {
    setImageFiles((prev) => [...prev, ...files].slice(0, MAX_IMAGES))
    setError(null)
  }

  const handleRemoveImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGenerate = async () => {
    if (!imageFiles.length) return
    if (!USER_ID) {
      setError('Missing user ID. Set VITE_PLACEHOLDER_USER_ID in your .env file.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await extractToDocx({
        files: imageFiles,
      })

      update({
        patientId: data.patientId,
        filename: data.filename,
      })

      navigate(editSummaryPath(USER_ID, data.patientId), {
        replace: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setLoading(false)
    }
  }

  const handleOpenPatient = (patient) => {
    if (!USER_ID || !patient?.patient_id) return
    update({ patientId: patient.patient_id })
    navigate(editSummaryPath(USER_ID, patient.patient_id))
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Discharge Summary
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Upload clinical notes and labs to create a summary
          </p>
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
              message="This usually takes a minute. Keep this tab open."
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

          {!loading && USER_ID && (
            <PastPatientsList
              patients={patients}
              loading={patientsLoading}
              error={patientsError}
              onSelect={handleOpenPatient}
            />
          )}
        </section>
      </main>
    </div>
  )
}

import { useState } from 'react'
import { IMAGE_ACCEPT, MAX_IMAGES } from '../config.js'
import { uploadTemplate } from '../api/templates.js'
import { extractImages } from '../api/extract.js'
import { generateSummary } from '../api/summarize.js'
import { useWorkflow } from '../hooks/useWorkflow.js'
import StepIndicator from '../components/StepIndicator.jsx'
import FileDropzone from '../components/FileDropzone.jsx'
import LoadingPanel from '../components/LoadingPanel.jsx'
import ErrorAlert from '../components/ErrorAlert.jsx'
import DocumentViewer from '../components/DocumentViewer.jsx'

const STEP_STATUS = {
  IDLE: 'idle',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
}

function truncateId(id) {
  if (!id) return ''
  return `${id.slice(0, 8)}…`
}

export default function WorkflowPage() {
  const { workflow, update, reset } = useWorkflow()
  const [currentStep, setCurrentStep] = useState(1)

  const [templateFile, setTemplateFile] = useState(null)
  const [step1Status, setStep1Status] = useState(
    workflow.templateId ? STEP_STATUS.SUCCESS : STEP_STATUS.IDLE,
  )
  const [step1Error, setStep1Error] = useState(null)

  const [imageFiles, setImageFiles] = useState([])
  const [step2Status, setStep2Status] = useState(
    workflow.extractionId ? STEP_STATUS.SUCCESS : STEP_STATUS.IDLE,
  )
  const [step2Error, setStep2Error] = useState(null)

  const [step3Status, setStep3Status] = useState(
    workflow.summaryId ? STEP_STATUS.SUCCESS : STEP_STATUS.IDLE,
  )
  const [step3Error, setStep3Error] = useState(null)

  const completedSteps = []
  if (workflow.templateId) completedSteps.push(1)
  if (workflow.extractionId) completedSteps.push(2)
  if (workflow.summaryId) completedSteps.push(3)

  const handleReset = () => {
    reset()
    setCurrentStep(1)
    setTemplateFile(null)
    setStep1Status(STEP_STATUS.IDLE)
    setStep1Error(null)
    setImageFiles([])
    setStep2Status(STEP_STATUS.IDLE)
    setStep2Error(null)
    setStep3Status(STEP_STATUS.IDLE)
    setStep3Error(null)
  }

  const handleTemplateUpload = async () => {
    if (!templateFile) return
    setStep1Status(STEP_STATUS.PROCESSING)
    setStep1Error(null)
    try {
      const data = await uploadTemplate(templateFile)
      update({
        templateId: data.template_id,
        templateViewUrl: data.view_url,
      })
      setStep1Status(STEP_STATUS.SUCCESS)
    } catch (err) {
      setStep1Status(STEP_STATUS.ERROR)
      setStep1Error(err.message)
    }
  }

  const handleAddImages = (files) => {
    setImageFiles((prev) => {
      const combined = [...prev, ...files].slice(0, MAX_IMAGES)
      return combined
    })
    setStep2Error(null)
    if (workflow.extractionId) {
      setStep2Status(STEP_STATUS.IDLE)
      update({ patientId: null, extractionId: null, summaryId: null, summaryViewUrl: null })
      setStep3Status(STEP_STATUS.IDLE)
      setStep3Error(null)
    }
  }

  const handleRemoveImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleExtract = async () => {
    if (!imageFiles.length) return
    setStep2Status(STEP_STATUS.PROCESSING)
    setStep2Error(null)
    try {
      const data = await extractImages(imageFiles)
      update({
        patientId: data.patient_id,
        extractionId: data.extraction_id,
        summaryId: null,
        summaryViewUrl: null,
      })
      setStep2Status(STEP_STATUS.SUCCESS)
      setStep3Status(STEP_STATUS.IDLE)
      setStep3Error(null)
    } catch (err) {
      setStep2Status(STEP_STATUS.ERROR)
      setStep2Error(err.message)
    }
  }

  const handleGenerate = async () => {
    if (!workflow.patientId || !workflow.extractionId || !workflow.templateId) return
    setStep3Status(STEP_STATUS.PROCESSING)
    setStep3Error(null)
    try {
      const data = await generateSummary(
        workflow.patientId,
        workflow.extractionId,
        workflow.templateId,
      )
      update({
        summaryId: data.summary_id,
        summaryViewUrl: data.view_url,
      })
      setStep3Status(STEP_STATUS.SUCCESS)
    } catch (err) {
      setStep3Status(STEP_STATUS.ERROR)
      setStep3Error(err.message)
    }
  }

  const isProcessing =
    step1Status === STEP_STATUS.PROCESSING ||
    step2Status === STEP_STATUS.PROCESSING ||
    step3Status === STEP_STATUS.PROCESSING

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                Discharge Summary
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Upload template, patient documents, and generate summary
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={isProcessing}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start over
            </button>
          </div>
          <div className="mt-5">
            <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {currentStep === 1 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Upload template PDF</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your hospital discharge summary template. Conversion may take 10–30 seconds.
              </p>
            </div>

            {step1Status !== STEP_STATUS.PROCESSING && (
              <FileDropzone
                accept=".pdf,application/pdf"
                label="Discharge summary template (PDF)"
                hint="One PDF file"
                disabled={step1Status === STEP_STATUS.PROCESSING}
                onFiles={(files) => {
                  setTemplateFile(files[0])
                  setStep1Error(null)
                  if (workflow.templateId) {
                    setStep1Status(STEP_STATUS.IDLE)
                    update({ templateId: null, templateViewUrl: null })
                  }
                }}
              />
            )}

            {templateFile && step1Status !== STEP_STATUS.SUCCESS && (
              <p className="text-sm text-slate-600">
                Selected: <span className="font-medium">{templateFile.name}</span>
              </p>
            )}

            {step1Status === STEP_STATUS.PROCESSING && (
              <LoadingPanel
                title="Converting template…"
                message="Running pdf2htmlEX. This usually takes 10–30 seconds."
              />
            )}

            <ErrorAlert message={step1Error} onDismiss={() => setStep1Error(null)} />

            {step1Status === STEP_STATUS.SUCCESS && workflow.templateViewUrl && (
              <div className="rounded-lg border border-clinical-200 bg-clinical-50 px-4 py-3">
                <p className="text-sm font-medium text-clinical-800">Template ready</p>
                <p className="mt-1 text-xs text-clinical-700">
                  ID: {truncateId(workflow.templateId)}
                </p>
                <a
                  href={workflow.templateViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-clinical-600 hover:text-clinical-700"
                >
                  Open template in new tab →
                </a>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {step1Status !== STEP_STATUS.SUCCESS && (
                <button
                  type="button"
                  onClick={handleTemplateUpload}
                  disabled={!templateFile || step1Status === STEP_STATUS.PROCESSING}
                  className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload template
                </button>
              )}
              {step1Status === STEP_STATUS.SUCCESS && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700"
                >
                  Next: Patient documents
                </button>
              )}
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Upload patient documents</h2>
              <p className="mt-1 text-sm text-slate-500">
                Clinical notes, labs, and scans. Order matters — first file = page 1. Max {MAX_IMAGES} images.
              </p>
            </div>

            {step2Status !== STEP_STATUS.PROCESSING && (
              <FileDropzone
                accept={IMAGE_ACCEPT}
                multiple
                label="Patient document images"
                hint="JPG, PNG, TIFF, BMP"
                disabled={step2Status === STEP_STATUS.PROCESSING || imageFiles.length >= MAX_IMAGES}
                onFiles={handleAddImages}
              />
            )}

            {imageFiles.length > 0 && (
              <ol className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                {imageFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="text-slate-600">
                      <span className="font-mono text-xs text-slate-400 mr-2">{index + 1}.</span>
                      {file.name}
                    </span>
                    {step2Status !== STEP_STATUS.PROCESSING && (
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {step2Status === STEP_STATUS.PROCESSING && (
              <LoadingPanel
                title="Extracting clinical data…"
                message="Gemini OCR is processing your images. This can take several minutes."
                warning="Please don't close this tab until extraction completes."
              />
            )}

            <ErrorAlert message={step2Error} onDismiss={() => setStep2Error(null)} />

            {step2Status === STEP_STATUS.SUCCESS && (
              <div className="rounded-lg border border-clinical-200 bg-clinical-50 px-4 py-3">
                <p className="text-sm font-medium text-clinical-800">Extraction complete</p>
                <p className="mt-1 text-xs text-clinical-700">
                  Patient: {truncateId(workflow.patientId)} · Extraction: {truncateId(workflow.extractionId)}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                disabled={step2Status === STEP_STATUS.PROCESSING}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
              {step2Status !== STEP_STATUS.SUCCESS && (
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!imageFiles.length || step2Status === STEP_STATUS.PROCESSING}
                  className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Extract data
                </button>
              )}
              {step2Status === STEP_STATUS.SUCCESS && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700"
                >
                  Next: Generate summary
                </button>
              )}
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Generate discharge summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fill the template with extracted patient data using Gemini.
              </p>
            </div>

            <dl className="rounded-lg border border-slate-200 bg-white text-sm divide-y divide-slate-100">
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Template</dt>
                <dd className="font-mono text-xs text-slate-700">{workflow.templateId ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Patient</dt>
                <dd className="font-mono text-xs text-slate-700">{workflow.patientId ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-slate-500">Extraction</dt>
                <dd className="font-mono text-xs text-slate-700">{workflow.extractionId ?? '—'}</dd>
              </div>
            </dl>

            {step3Status === STEP_STATUS.PROCESSING && (
              <LoadingPanel
                title="Generating summary…"
                message="Gemini is filling your discharge summary. This may take a minute."
                warning="Please don't close this tab until generation completes."
              />
            )}

            <ErrorAlert message={step3Error} onDismiss={() => setStep3Error(null)} />

            {step3Status === STEP_STATUS.SUCCESS && workflow.summaryViewUrl && (
              <DocumentViewer url={workflow.summaryViewUrl} title="Discharge summary preview" />
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={step3Status === STEP_STATUS.PROCESSING}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
              {step3Status !== STEP_STATUS.SUCCESS && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={
                    !workflow.templateId ||
                    !workflow.patientId ||
                    !workflow.extractionId ||
                    step3Status === STEP_STATUS.PROCESSING
                  }
                  className="rounded-md bg-clinical-600 px-4 py-2 text-sm font-medium text-white hover:bg-clinical-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate summary
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

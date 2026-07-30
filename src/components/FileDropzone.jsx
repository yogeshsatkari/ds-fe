import { useCallback, useRef, useState } from 'react'

export default function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  label,
  hint,
  onFiles,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList?.length || disabled) return
      const files = multiple ? Array.from(fileList) : [fileList[0]]
      onFiles(files)
    },
    [disabled, multiple, onFiles],
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={[
        'rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
          : dragOver
            ? 'border-clinical-500 bg-clinical-50 cursor-pointer'
            : 'border-slate-300 bg-white hover:border-clinical-400 hover:bg-slate-50 cursor-pointer',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <p className="mt-3 text-xs text-slate-400">Click or drag files here</p>
    </div>
  )
}

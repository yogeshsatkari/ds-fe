const STEPS = [
  { id: 1, label: 'Template' },
  { id: 2, label: 'Patient docs' },
  { id: 3, label: 'Generate' },
]

export default function StepIndicator({ currentStep, completedSteps }) {
  return (
    <nav aria-label="Workflow progress" className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isActive = currentStep === step.id
        const isCompleted = completedSteps.includes(step.id)
        const isLast = index === STEPS.length - 1

        return (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isActive
                    ? 'bg-clinical-600 text-white'
                    : isCompleted
                      ? 'bg-clinical-100 text-clinical-700'
                      : 'bg-slate-100 text-slate-400',
                ].join(' ')}
              >
                {isCompleted && !isActive ? '✓' : step.id}
              </span>
              <span
                className={[
                  'text-sm font-medium',
                  isActive ? 'text-slate-800' : isCompleted ? 'text-slate-600' : 'text-slate-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={[
                  'mx-1 h-px w-8 sm:w-12',
                  isCompleted ? 'bg-clinical-300' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

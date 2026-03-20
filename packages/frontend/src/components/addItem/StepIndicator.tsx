import { Check } from "lucide-react";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick: (step: number) => void;
  completedSteps: Set<number>;
}

export function StepIndicator({ steps, currentStep, onStepClick, completedSteps }: StepIndicatorProps) {
  return (
    <div className={`grid w-full max-w-2xl mx-auto mb-8`} style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((label, i) => {
        const isCompleted = completedSteps.has(i);
        const isCurrent = i === currentStep;
        const isClickable = isCompleted || i <= currentStep;

        return (
          <div key={label} className="flex flex-col items-center relative">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(i)}
              className={`flex flex-col items-center gap-1.5 z-10 ${isClickable ? "cursor-pointer" : "cursor-default opacity-50"}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isCurrent
                    ? "bg-brand text-primary-foreground ring-2 ring-brand/30 ring-offset-2 ring-offset-background"
                    : isCompleted
                      ? "bg-brand/80 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted && !isCurrent ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs text-center hidden sm:block ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <div className={`absolute top-4 left-[calc(50%+20px)] right-0 -mr-[calc(50%-20px)] h-0.5 ${isCompleted ? "bg-brand/60" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

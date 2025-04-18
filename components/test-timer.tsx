import { formatTime } from "@/lib/utils"

interface TestTimerProps {
  timeRemaining: number
}

export default function TestTimer({ timeRemaining }: TestTimerProps) {
  const getTimerColor = () => {
    if (timeRemaining < 300) return "text-red-600 dark:text-red-400" // Less than 5 minutes
    if (timeRemaining < 600) return "text-orange-500 dark:text-orange-400" // Less than 10 minutes
    return "text-green-600 dark:text-green-400"
  }

  return (
    <div className="flex items-center">
      <div className={`text-xl font-bold ${getTimerColor()}`}>{formatTime(timeRemaining)}</div>
    </div>
  )
}

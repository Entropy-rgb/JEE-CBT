"use client"

import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatTime } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

interface TestHeaderProps {
  timeRemaining: number
  onSubmit: () => void
  lastSaved: Date | null
}

export default function TestHeader({ timeRemaining, onSubmit, lastSaved }: TestHeaderProps) {
  return (
    <header className="bg-primary/90 text-primary-foreground p-2 sticky top-0 z-10 backdrop-blur-sm">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span className="font-medium">{formatTime(timeRemaining)}</span>
          </div>
          {lastSaved && <div className="text-xs opacity-70">Auto-saved at {lastSaved.toLocaleTimeString()}</div>}
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Button variant="destructive" onClick={onSubmit} className="bg-red-600 hover:bg-red-700">
            Submit Test
          </Button>
        </div>
      </div>
    </header>
  )
}

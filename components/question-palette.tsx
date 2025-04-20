"use client"

import { Button } from "@/components/ui/button"
import { useEffect } from "react"

interface Question {
  id: number
  userAnswer: string | string[] | null
  isMarkedForReview: boolean
  isVisited: boolean
}

interface QuestionPaletteProps {
  questions: Question[]
  currentIndex: number
  onQuestionClick: (index: number) => void
}

export default function QuestionPalette({ questions, currentIndex, onQuestionClick }: QuestionPaletteProps) {
  // Ensure question 1 is always marked as visited
  useEffect(() => {
    if (questions.length > 0 && !questions[0].isVisited) {
      // Create a copy of the questions array
      const updatedQuestions = [...questions]
      updatedQuestions[0] = {
        ...updatedQuestions[0],
        isVisited: true,
      }

      // Use a custom event to notify the parent component
      const event = new CustomEvent("questionOneVisited", {
        detail: { updatedQuestions },
      })
      window.dispatchEvent(event)
    }
  }, [questions])

  const getQuestionStatus = (question: Question, index: number) => {
    if (index === currentIndex) return "current"
    // Add a new status for questions that are both answered and marked for review
    if (
      question.isMarkedForReview &&
      question.userAnswer !== null &&
      (!Array.isArray(question.userAnswer) || question.userAnswer.length > 0)
    )
      return "answered-review"
    if (question.isMarkedForReview) return "review"
    if (question.userAnswer !== null && (!Array.isArray(question.userAnswer) || question.userAnswer.length > 0))
      return "answered"
    if (question.isVisited) return "visited"
    return "not-visited"
  }

  const getButtonVariant = (status: string) => {
    switch (status) {
      case "current":
        return "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
      case "review":
        return "bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700"
      case "answered":
        return "bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
      case "answered-review":
        return "bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
      case "visited":
        return "bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
      default:
        return "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
    }
  }

  return (
    <div className="bg-card p-4 rounded-lg shadow mb-4">
      <h3 className="font-medium mb-3">Question Palette</h3>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((question, index) => {
          const status = getQuestionStatus(question, index)
          const buttonClass = getButtonVariant(status)

          return (
            <Button key={question.id} className={`w-10 h-10 p-0 ${buttonClass}`} onClick={() => onQuestionClick(index)}>
              {index + 1}
            </Button>
          )
        })}
      </div>

      <div className="mt-4 text-sm space-y-2">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 dark:bg-green-600 rounded-full mr-2"></div>
          <span>Answered</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-amber-500 dark:bg-amber-600 rounded-full mr-2"></div>
          <span>Answered & Marked for review</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-500 dark:bg-red-600 rounded-full mr-2"></div>
          <span>Visited but not answered</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-purple-500 dark:bg-purple-600 rounded-full mr-2"></div>
          <span>Marked for review</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full mr-2"></div>
          <span>Not visited</span>
        </div>
      </div>
    </div>
  )
}

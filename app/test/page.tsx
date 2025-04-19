"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import QuestionPalette from "@/components/question-palette"
import TestHeader from "@/components/test-header"
import { StorageService } from "@/lib/storage-service"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase-client"

type QuestionType = "singleCorrect" | "multipleCorrect" | "numerical"

interface Question {
  id: number
  type: QuestionType
  userAnswer: string | string[] | null
  isMarkedForReview: boolean
  isVisited: boolean
  timeSpent: number
  visitCount: number
  screenshot?: string | null
}

export default function TestPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [testConfig, setTestConfig] = useState<any>(null)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [testSubmitted, setTestSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [testStartTime, setTestStartTime] = useState<Date | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null)
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  const [useServerStorage, setUseServerStorage] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Auto-save interval reference
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Reference to track if component is mounted
  const isMounted = useRef(true)

  // Reference to track if the test has been initialized
  const testInitializedRef = useRef(false)

  // Reference to store the current question data to prevent state loss
  const currentQuestionRef = useRef<Question | null>(null)

  useEffect(() => {
    return () => {
      isMounted.current = false
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [])

  // Load saved test progress or initialize new test
  useEffect(() => {
    const loadTest = async () => {
      if (testInitializedRef.current) return
      testInitializedRef.current = true

      try {
        // Get test configuration
        const configStr = localStorage.getItem("testConfig")
        if (!configStr) {
          router.push("/configure")
          return
        }

        const config = JSON.parse(configStr)
        setTestConfig(config)
        setIsScreenshotMode(config.isScreenshotMode || false)
        setUseServerStorage(config.useServerStorage !== undefined ? config.useServerStorage : true)

        // Try to load saved progress from Supabase if user is logged in
        let savedProgress = null

        if (user && user.id) {
          try {
            const { data, error } = await supabase
              .from("test_progress")
              .select("progress")
              .eq("user_id", user.id)
              .single()

            if (data && !error) {
              savedProgress = data.progress
              toast({
                title: "Progress loaded from cloud",
                description: "Your test progress has been loaded from your account.",
              })
            }
          } catch (err) {
            console.error("Error loading from Supabase:", err)
          }
        }

        // If no Supabase data, try local storage
        if (!savedProgress) {
          savedProgress = await StorageService.loadData({
            useServerStorage: config.useServerStorage,
          })
        }

        if (savedProgress) {
          // Ensure all multiple choice questions have arrays (not null)
          const fixedQuestions = savedProgress.questions.map((q: Question) => {
            if (q.type === "multipleCorrect" && q.userAnswer === null) {
              return { ...q, userAnswer: [] }
            }
            return q
          })

          setQuestions(fixedQuestions)
          const startIndex = savedProgress.currentQuestionIndex || 0
          setCurrentQuestionIndex(startIndex)

          // Set the current question reference
          if (fixedQuestions.length > 0 && fixedQuestions[startIndex]) {
            currentQuestionRef.current = fixedQuestions[startIndex]
          }

          setTimeRemaining(savedProgress.timeRemaining || config.timeInMinutes * 60)
          setTestStartTime(savedProgress.testStartTime ? new Date(savedProgress.testStartTime) : new Date())
          setQuestionStartTime(new Date())
          setLastSaved(savedProgress.lastSaved ? new Date(savedProgress.lastSaved) : null)
          setIsLoading(false)

          toast({
            title: "Test progress restored",
            description: "Your previous test progress has been loaded.",
          })
          return
        }

        // No saved progress, initialize new test
        setTimeRemaining(config.timeInMinutes * 60)

        // Generate empty questions based on configuration
        const generatedQuestions: Question[] = []

        // Set question types based on configuration type
        if (config.configType === "basic") {
          // Basic configuration - distribute question types evenly
          const availableTypes: QuestionType[] = []
          if (config.questionTypes.singleCorrect) availableTypes.push("singleCorrect")
          if (config.questionTypes.multipleCorrect) availableTypes.push("multipleCorrect")
          if (config.questionTypes.numerical) availableTypes.push("numerical")

          for (let i = 0; i < config.numQuestions; i++) {
            const type = availableTypes[i % availableTypes.length]
            generatedQuestions.push({
              id: i + 1,
              type,
              // Initialize multiple choice questions with empty arrays, not null
              userAnswer: type === "multipleCorrect" ? [] : null,
              isMarkedForReview: false,
              isVisited: i === 0, // Mark first question as visited
              timeSpent: 0,
              visitCount: i === 0 ? 1 : 0, // First question has been visited once
              screenshot: config.isScreenshotMode && config.screenshots ? config.screenshots[i] : null,
            })
          }
        } else {
          // Advanced configuration - use specific question types
          for (let i = 0; i < config.numQuestions; i++) {
            const type = config.specificQuestionTypes[i]
            generatedQuestions.push({
              id: i + 1,
              type,
              // Initialize multiple choice questions with empty arrays, not null
              userAnswer: type === "multipleCorrect" ? [] : null,
              isMarkedForReview: false,
              isVisited: i === 0, // Mark first question as visited
              timeSpent: 0,
              visitCount: i === 0 ? 1 : 0, // First question has been visited once
              screenshot: config.isScreenshotMode && config.screenshots ? config.screenshots[i] : null,
            })
          }
        }

        setQuestions(generatedQuestions)

        // Set the current question reference
        if (generatedQuestions.length > 0) {
          currentQuestionRef.current = generatedQuestions[0]
        }

        setIsLoading(false)
        setTestStartTime(new Date())
        setQuestionStartTime(new Date())

        // Initial save of the test state
        const initialSaveTime = new Date()
        setLastSaved(initialSaveTime)

        const progressData = {
          questions: generatedQuestions,
          currentQuestionIndex: 0,
          timeRemaining: config.timeInMinutes * 60,
          testConfig: config,
          testStartTime: new Date().toISOString(),
          isScreenshotMode: config.isScreenshotMode,
          lastSaved: initialSaveTime.toISOString(),
        }

        await StorageService.saveData(progressData, { useServerStorage: config.useServerStorage })

        // If user is logged in, also save to Supabase
        if (user && user.id) {
          try {
            await supabase.from("test_progress").upsert({
              user_id: user.id,
              progress: progressData,
              updated_at: new Date().toISOString(),
            })
          } catch (err) {
            console.error("Error saving to Supabase:", err)
          }
        }
      } catch (error) {
        console.error("Error initializing test:", error)
        router.push("/configure")
      }
    }

    loadTest()
  }, [router, toast, user])

  // Update currentQuestionRef when questions or currentQuestionIndex changes
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      currentQuestionRef.current = questions[currentQuestionIndex]
    }
  }, [questions, currentQuestionIndex])

  // Set up auto-save functionality
  useEffect(() => {
    if (isLoading || testSubmitted) return

    // Save progress every 1 second
    autoSaveIntervalRef.current = setInterval(() => {
      saveProgress(false)
    }, 1000)

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [isLoading, testSubmitted])

  // Function to save current progress to storage
  const saveProgress = async (showToast = false) => {
    if (!testConfig || testSubmitted || questions.length === 0) return

    // Update time spent on current question before saving
    let updatedQuestions = [...questions]
    if (questionStartTime) {
      const now = new Date()
      const timeSpent = Math.floor((now.getTime() - questionStartTime.getTime()) / 1000)

      // Only add reasonable time (less than the total test time)
      const reasonableTime = Math.min(timeSpent, testConfig.timeInMinutes * 60 || 3600)

      updatedQuestions = updatedQuestions.map((q, idx) => {
        if (idx === currentQuestionIndex) {
          return { ...q, timeSpent: q.timeSpent + reasonableTime }
        }
        return q
      })

      // Reset the question start time after calculating time spent
      setQuestionStartTime(now)
    }

    const saveTime = new Date()
    setLastSaved(saveTime)

    const progressData = {
      questions: updatedQuestions,
      currentQuestionIndex,
      timeRemaining,
      testConfig,
      testStartTime: testStartTime?.toISOString(),
      isScreenshotMode,
      lastSaved: saveTime.toISOString(),
    }

    try {
      await StorageService.saveData(progressData, { useServerStorage })

      // If user is logged in, also save to Supabase
      if (user && user.id) {
        try {
          await supabase.from("test_progress").upsert({
            user_id: user.id,
            progress: progressData,
            updated_at: new Date().toISOString(),
          })
        } catch (err) {
          console.error("Error saving to Supabase:", err)
        }
      }

      // Update questions state with the updated time spent
      setQuestions(updatedQuestions)

      if (showToast) {
        toast({
          title: "Progress saved",
          description: "Your test progress has been saved successfully.",
        })
      }
    } catch (error) {
      console.error("Error saving progress:", error)
      if (showToast) {
        toast({
          title: "Error saving progress",
          description: "There was an error saving your progress. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Update time spent on current question when changing questions
  useEffect(() => {
    if (questionStartTime && !isLoading && questions.length > 0) {
      return () => {
        if (isMounted.current) {
          const now = new Date()
          const timeSpent = Math.floor((now.getTime() - questionStartTime.getTime()) / 1000)

          setQuestions((prevQuestions) => {
            const updatedQuestions = [...prevQuestions]
            if (updatedQuestions[currentQuestionIndex]) {
              updatedQuestions[currentQuestionIndex].timeSpent += timeSpent
            }
            return updatedQuestions
          })
        }
      }
    }
  }, [currentQuestionIndex, questionStartTime, isLoading, questions.length])

  useEffect(() => {
    if (isLoading) return

    if (timeRemaining <= 0 && !testSubmitted) {
      // Only submit if testConfig is available
      if (testConfig) {
        handleSubmitTest()
      } else {
        // If no testConfig, redirect to configure page
        console.error("Test configuration is missing, redirecting to configure page")
        router.push("/configure")
      }
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, testSubmitted, testConfig, router, isLoading])

  // Handle answer change for single correct questions
  const handleSingleCorrectAnswerChange = useCallback(
    (answer: string) => {
      if (questions.length === 0) return

      setQuestions((prevQuestions) => {
        const updatedQuestions = [...prevQuestions]
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          userAnswer: answer,
          isVisited: true,
        }
        return updatedQuestions
      })

      // Update the current question reference immediately
      if (currentQuestionRef.current) {
        currentQuestionRef.current = {
          ...currentQuestionRef.current,
          userAnswer: answer,
          isVisited: true,
        }
      }

      // Save progress after state update
      setTimeout(() => saveProgress(false), 0)
    },
    [currentQuestionIndex, questions.length],
  )

  // Handle checkbox change for multiple correct questions
  const handleMultipleCorrectAnswerChange = useCallback(
    (option: string, checked: boolean) => {
      if (questions.length === 0) return

      setQuestions((prevQuestions) => {
        const updatedQuestions = [...prevQuestions]
        const currentQuestion = updatedQuestions[currentQuestionIndex]

        // Ensure userAnswer is an array
        const currentAnswers = Array.isArray(currentQuestion.userAnswer) ? [...currentQuestion.userAnswer] : []

        let newAnswers: string[]

        if (checked) {
          // Add option if checked
          newAnswers = [...currentAnswers, option]
        } else {
          // Remove option if unchecked
          newAnswers = currentAnswers.filter((ans) => ans !== option)
        }

        updatedQuestions[currentQuestionIndex] = {
          ...currentQuestion,
          userAnswer: newAnswers,
          isVisited: true,
        }

        return updatedQuestions
      })

      // Update the current question reference immediately
      if (currentQuestionRef.current) {
        const currentAnswers = Array.isArray(currentQuestionRef.current.userAnswer)
          ? [...currentQuestionRef.current.userAnswer]
          : []

        let newAnswers: string[]

        if (checked) {
          newAnswers = [...currentAnswers, option]
        } else {
          newAnswers = currentAnswers.filter((ans) => ans !== option)
        }

        currentQuestionRef.current = {
          ...currentQuestionRef.current,
          userAnswer: newAnswers,
          isVisited: true,
        }
      }

      // Save progress after state update
      setTimeout(() => saveProgress(false), 0)
    },
    [currentQuestionIndex, questions.length],
  )

  // Handle numerical answer change
  const handleNumericalAnswerChange = useCallback(
    (value: string) => {
      if (questions.length === 0) return

      setQuestions((prevQuestions) => {
        const updatedQuestions = [...prevQuestions]
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          userAnswer: value,
          isVisited: true,
        }
        return updatedQuestions
      })

      // Update the current question reference immediately
      if (currentQuestionRef.current) {
        currentQuestionRef.current = {
          ...currentQuestionRef.current,
          userAnswer: value,
          isVisited: true,
        }
      }

      // Save progress after state update
      setTimeout(() => saveProgress(false), 0)
    },
    [currentQuestionIndex, questions.length],
  )

  // Add a new function to clear responses
  const handleClearResponse = useCallback(() => {
    if (questions.length === 0) return

    setQuestions((prevQuestions) => {
      const updatedQuestions = [...prevQuestions]
      const currentType = updatedQuestions[currentQuestionIndex].type

      // Set to appropriate empty value based on question type
      if (currentType === "multipleCorrect") {
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          userAnswer: [],
        }
      } else {
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          userAnswer: null,
        }
      }

      return updatedQuestions
    })

    // Update the current question reference immediately
    if (currentQuestionRef.current) {
      const currentType = currentQuestionRef.current.type

      if (currentType === "multipleCorrect") {
        currentQuestionRef.current = {
          ...currentQuestionRef.current,
          userAnswer: [],
        }
      } else {
        currentQuestionRef.current = {
          ...currentQuestionRef.current,
          userAnswer: null,
        }
      }
    }

    // Save progress after state update
    setTimeout(() => saveProgress(false), 0)
  }, [currentQuestionIndex, questions.length])

  const handleMarkForReview = useCallback(() => {
    if (questions.length === 0) return

    setQuestions((prevQuestions) => {
      const updatedQuestions = [...prevQuestions]
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        isMarkedForReview: !updatedQuestions[currentQuestionIndex].isMarkedForReview,
        isVisited: true,
      }
      return updatedQuestions
    })

    // Update the current question reference immediately
    if (currentQuestionRef.current) {
      currentQuestionRef.current = {
        ...currentQuestionRef.current,
        isMarkedForReview: !currentQuestionRef.current.isMarkedForReview,
        isVisited: true,
      }
    }

    // Save progress after state update
    setTimeout(() => saveProgress(false), 0)
  }, [currentQuestionIndex, questions.length])

  // Fix the time tracking logic by resetting the question start time when changing questions
  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < questions.length) {
        // Save the current question state before navigating
        const currentQuestionData = currentQuestionRef.current || questions[currentQuestionIndex]

        // Update time spent on current question before changing
        if (questionStartTime) {
          const now = new Date()
          const timeSpent = Math.floor((now.getTime() - questionStartTime.getTime()) / 1000)

          // Only add the time if it's reasonable (less than the total test time)
          const reasonableTime = Math.min(timeSpent, testConfig?.timeInMinutes * 60 || 3600)

          setQuestions((prevQuestions) => {
            const updatedQuestions = [...prevQuestions]

            // Update current question with the latest data from ref
            if (currentQuestionData) {
              updatedQuestions[currentQuestionIndex] = {
                ...currentQuestionData,
                timeSpent: (currentQuestionData.timeSpent || 0) + reasonableTime,
                isVisited: true,
              }
            } else {
              // Fallback if ref is not available
              updatedQuestions[currentQuestionIndex] = {
                ...updatedQuestions[currentQuestionIndex],
                timeSpent: updatedQuestions[currentQuestionIndex].timeSpent + reasonableTime,
                isVisited: true,
              }
            }

            // Update destination question
            updatedQuestions[index] = {
              ...updatedQuestions[index],
              isVisited: true,
              visitCount: updatedQuestions[index].visitCount + 1,
            }

            return updatedQuestions
          })
        } else {
          // If no questionStartTime, still mark questions as visited
          setQuestions((prevQuestions) => {
            const updatedQuestions = [...prevQuestions]

            // Update current question with the latest data from ref
            if (currentQuestionData) {
              updatedQuestions[currentQuestionIndex] = {
                ...currentQuestionData,
                isVisited: true,
              }
            } else {
              // Fallback if ref is not available
              updatedQuestions[currentQuestionIndex] = {
                ...updatedQuestions[currentQuestionIndex],
                isVisited: true,
              }
            }

            // Update destination question
            updatedQuestions[index] = {
              ...updatedQuestions[index],
              isVisited: true,
              visitCount: updatedQuestions[index].visitCount + 1,
            }

            return updatedQuestions
          })
        }

        // Update current question index
        setCurrentQuestionIndex(index)

        // Reset question start time
        setQuestionStartTime(new Date())

        // Save progress after state updates
        setTimeout(() => saveProgress(false), 0)
      }
    },
    [currentQuestionIndex, questionStartTime, questions.length, testConfig],
  )

  const handleSubmitTest = async () => {
    // Double check that testConfig exists before proceeding
    if (!testConfig) {
      console.error("Test configuration is missing")
      // Redirect to configure page
      router.push("/configure")
      return
    }

    // Update time spent on current question before submitting
    if (questionStartTime && questions.length > 0) {
      const now = new Date()
      const timeSpent = Math.floor((now.getTime() - questionStartTime.getTime()) / 1000)

      setQuestions((prevQuestions) => {
        const updatedQuestions = [...prevQuestions]
        updatedQuestions[currentQuestionIndex].timeSpent += timeSpent
        return updatedQuestions
      })
    }

    setTestSubmitted(true)

    // Calculate total test time
    const testEndTime = new Date()
    const totalTestTime = testStartTime
      ? Math.floor((testEndTime.getTime() - testStartTime.getTime()) / 1000)
      : testConfig.timeInMinutes * 60

    // Store test results in localStorage for analysis page
    const testResults = {
      questions,
      testConfig,
      completedAt: testEndTime.toISOString(),
      startedAt: testStartTime?.toISOString(),
      totalTestTime,
      isScreenshotMode,
    }

    localStorage.setItem("testResults", JSON.stringify(testResults))

    // If user is logged in, save test results to Supabase
    if (user && user.id) {
      try {
        await supabase.from("test_results").insert({
          user_id: user.id,
          results: testResults,
          completed_at: testEndTime.toISOString(),
        })

        // Clear the test progress
        await supabase.from("test_progress").delete().eq("user_id", user.id)
      } catch (err) {
        console.error("Error saving results to Supabase:", err)
      }
    }

    // Clear the saved progress since test is now submitted
    try {
      await StorageService.clearData({ useServerStorage })

      // Navigate to analysis page
      router.push("/analysis")
    } catch (error) {
      console.error("Error clearing saved progress:", error)
      // Navigate to analysis page anyway
      router.push("/analysis")
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading test...</div>
  }

  if (!testConfig || questions.length === 0) {
    return <div className="flex items-center justify-center min-h-screen">Loading test...</div>
  }

  // Use the current question from the ref if available, otherwise from the state
  const currentQuestion = currentQuestionRef.current || questions[currentQuestionIndex]

  // Check if the current question has an answer
  const hasAnswer =
    currentQuestion.userAnswer !== null &&
    (Array.isArray(currentQuestion.userAnswer) ? currentQuestion.userAnswer.length > 0 : true)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TestHeader timeRemaining={timeRemaining} onSubmit={() => setShowSubmitDialog(true)} lastSaved={lastSaved} />

      <div className="flex flex-1 p-4">
        <div className="w-3/4 pr-4">
          <Card className="p-6 h-full">
            <div className="flex justify-between mb-4">
              <div className="font-medium">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
              <div className="flex space-x-2">
                {hasAnswer && (
                  <Button variant="outline" size="sm" onClick={handleClearResponse} className="flex items-center gap-1">
                    <Trash2 className="h-4 w-4" />
                    Clear Response
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleMarkForReview}>
                  {currentQuestion.isMarkedForReview ? "Unmark for Review" : "Mark for Review"}
                </Button>
              </div>
            </div>

            {isScreenshotMode && (
              <div className="mb-6">
                {currentQuestion.screenshot ? (
                  <div className="mb-4">
                    <Image
                      src={currentQuestion.screenshot || "/placeholder.svg"}
                      alt={`Question ${currentQuestionIndex + 1}`}
                      width={600}
                      height={400}
                      className="max-w-full h-auto rounded-md border"
                    />
                  </div>
                ) : (
                  <div className="mb-4 p-4 border-2 border-dashed border-gray-300 rounded-md text-center">
                    <p className="text-muted-foreground mb-2">No screenshot available for this question</p>
                  </div>
                )}
              </div>
            )}

            {!isScreenshotMode && (
              <div className="mb-6">
                <p className="text-lg font-medium">
                  Please refer to Question {currentQuestionIndex + 1} in your printed material.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Question Type:{" "}
                  {currentQuestion.type === "singleCorrect"
                    ? "Single Correct Option"
                    : currentQuestion.type === "multipleCorrect"
                      ? "Multiple Correct Options"
                      : "Numerical Value"}
                </p>
              </div>
            )}

            {currentQuestion.type === "singleCorrect" && (
              <div className="space-y-3">
                <RadioGroup
                  value={(currentQuestion.userAnswer as string) || ""}
                  onValueChange={handleSingleCorrectAnswerChange}
                >
                  {["A", "B", "C", "D"].map((option, index) => (
                    <div
                      key={`option-${currentQuestionIndex}-${index}-${option}`}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem id={`option-${currentQuestionIndex}-${index}-${option}`} value={option} />
                      <Label htmlFor={`option-${currentQuestionIndex}-${index}-${option}`}>Option {option}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {currentQuestion.type === "multipleCorrect" && (
              <div className="space-y-3">
                {["A", "B", "C", "D"].map((option, index) => {
                  // Create a stable reference to the current answer array
                  const currentAnswers = Array.isArray(currentQuestion.userAnswer)
                    ? [...currentQuestion.userAnswer]
                    : []

                  return (
                    <div
                      key={`option-${currentQuestionIndex}-${index}-${option}`}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`option-${currentQuestionIndex}-${index}-${option}`}
                        checked={currentAnswers.includes(option)}
                        onCheckedChange={(checked) => {
                          handleMultipleCorrectAnswerChange(option, checked === true)
                        }}
                      />
                      <Label htmlFor={`option-${currentQuestionIndex}-${index}-${option}`}>Option {option}</Label>
                    </div>
                  )
                })}
              </div>
            )}

            {currentQuestion.type === "numerical" && (
              <div className="space-y-2">
                <Label htmlFor={`numerical-answer-${currentQuestionIndex}`}>Enter numerical value:</Label>
                <Input
                  id={`numerical-answer-${currentQuestionIndex}`}
                  type="number"
                  step="any"
                  value={(currentQuestion.userAnswer as string) || ""}
                  onChange={(e) => handleNumericalAnswerChange(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button onClick={() => goToQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}>
                Previous
              </Button>
              <Button
                onClick={() => goToQuestion(currentQuestionIndex + 1)}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                Next
              </Button>
            </div>
          </Card>
        </div>

        <div className="w-1/4">
          <QuestionPalette questions={questions} currentIndex={currentQuestionIndex} onQuestionClick={goToQuestion} />

          <Button className="w-full mt-4" variant="destructive" onClick={() => setShowSubmitDialog(true)}>
            Submit Test
          </Button>
        </div>
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your test? You won't be able to change your answers after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitTest}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

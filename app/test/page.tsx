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

  // Main state
  const [testState, setTestState] = useState<{
    questions: Question[]
    currentQuestionIndex: number
    timeRemaining: number
    testConfig: any | null
    testStartTime: Date | null
    questionStartTime: Date | null
    isScreenshotMode: boolean
    useServerStorage: boolean
    lastSaved: Date | null
    isLoading: boolean
    testSubmitted: boolean
    showSubmitDialog: boolean
  }>({
    questions: [],
    currentQuestionIndex: 0,
    timeRemaining: 0,
    testConfig: null,
    testStartTime: null,
    questionStartTime: null,
    isScreenshotMode: false,
    useServerStorage: true,
    lastSaved: null,
    isLoading: true,
    testSubmitted: false,
    showSubmitDialog: false,
  })

  // Refs to track component lifecycle and prevent memory leaks
  const isMounted = useRef(true)
  const testInitializedRef = useRef(false)
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Create a stable reference to the current question to prevent state loss
  const currentQuestionRef = useRef<Question | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [])

  // Function to save current progress to storage
  const saveProgress = useCallback(
    async (showToast = false) => {
      const {
        testConfig,
        testSubmitted,
        questions,
        currentQuestionIndex,
        timeRemaining,
        testStartTime,
        isScreenshotMode,
        useServerStorage,
        questionStartTime,
      } = testState

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
        setTestState((prev) => ({
          ...prev,
          questionStartTime: now,
        }))
      }

      const saveTime = new Date()
      setTestState((prev) => ({
        ...prev,
        lastSaved: saveTime,
        questions: updatedQuestions,
      }))

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
    },
    [testState, user, supabase, toast],
  )

  // Load test configuration and saved progress
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

          const startIndex = savedProgress.currentQuestionIndex || 0

          // Set the current question reference
          if (fixedQuestions.length > 0 && fixedQuestions[startIndex]) {
            currentQuestionRef.current = fixedQuestions[startIndex]
          }

          setTestState((prev) => ({
            ...prev,
            questions: fixedQuestions,
            currentQuestionIndex: startIndex,
            timeRemaining: savedProgress.timeRemaining || config.timeInMinutes * 60,
            testConfig: config,
            testStartTime: savedProgress.testStartTime ? new Date(savedProgress.testStartTime) : new Date(),
            questionStartTime: new Date(),
            isScreenshotMode: config.isScreenshotMode || false,
            useServerStorage: config.useServerStorage !== undefined ? config.useServerStorage : true,
            lastSaved: savedProgress.lastSaved ? new Date(savedProgress.lastSaved) : null,
            isLoading: false,
          }))

          toast({
            title: "Test progress restored",
            description: "Your previous test progress has been loaded.",
          })
          return
        }

        // No saved progress, initialize new test
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

        // Set the current question reference
        if (generatedQuestions.length > 0) {
          currentQuestionRef.current = generatedQuestions[0]
        }

        const initialSaveTime = new Date()

        setTestState((prev) => ({
          ...prev,
          questions: generatedQuestions,
          timeRemaining: config.timeInMinutes * 60,
          testConfig: config,
          testStartTime: new Date(),
          questionStartTime: new Date(),
          isScreenshotMode: config.isScreenshotMode || false,
          useServerStorage: config.useServerStorage !== undefined ? config.useServerStorage : true,
          lastSaved: initialSaveTime,
          isLoading: false,
        }))

        // Initial save of the test state
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
  }, [router, toast, user, saveProgress])

  // Update currentQuestionRef when questions changes
  useEffect(() => {
    const { questions, currentQuestionIndex } = testState
    if (questions.length > 0 && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      currentQuestionRef.current = questions[currentQuestionIndex]
    }
  }, [testState])

  // Add this effect to listen for the custom event from QuestionPalette
  // Add this right after the other useEffect hooks:

  // Listen for the questionOneVisited event from QuestionPalette
  useEffect(() => {
    const handleQuestionOneVisited = (event: any) => {
      const { updatedQuestions } = event.detail
      if (updatedQuestions && updatedQuestions.length > 0) {
        setTestState((prev) => ({
          ...prev,
          questions: updatedQuestions,
        }))
      }
    }

    window.addEventListener("questionOneVisited", handleQuestionOneVisited)
    return () => {
      window.removeEventListener("questionOneVisited", handleQuestionOneVisited)
    }
  }, [])

  // Set up auto-save functionality
  useEffect(() => {
    const { isLoading, testSubmitted } = testState
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
  }, [testState.isLoading, testState.testSubmitted, saveProgress])

  // Timer effect
  useEffect(() => {
    const { timeRemaining, testConfig, isLoading, testSubmitted } = testState
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
      setTestState((prev) => ({
        ...prev,
        timeRemaining: prev.timeRemaining - 1,
      }))
    }, 1000)

    return () => clearInterval(timer)
  }, [testState.timeRemaining, testState.testSubmitted, testState.testConfig, testState.isLoading, router])

  // Handle answer change for single correct questions
  const handleSingleCorrectAnswerChange = useCallback(
    (answer: string) => {
      const { questions, currentQuestionIndex } = testState
      if (questions.length === 0) return

      // Update the state with the new answer
      setTestState((prev) => {
        const updatedQuestions = [...prev.questions]
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          userAnswer: answer,
          isVisited: true,
        }
        return {
          ...prev,
          questions: updatedQuestions,
        }
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
    [testState, saveProgress],
  )

  // Handle checkbox change for multiple correct questions
  const handleMultipleCorrectAnswerChange = useCallback(
    (option: string, checked: boolean) => {
      const { questions, currentQuestionIndex } = testState
      if (questions.length === 0) return

      setTestState((prev) => {
        const updatedQuestions = [...prev.questions]
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

        return {
          ...prev,
          questions: updatedQuestions,
        }
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
    [testState, saveProgress],
  )

  // Handle numerical answer change
  const handleNumericalAnswerChange = useCallback(
    (value: string) => {
      const { questions, currentQuestionIndex } = testState
      if (questions.length === 0) return

      setTestState((prev) => {
        const updatedQuestions = [...prev.questions]
        updatedQuestions[currentQuestionIndex] = {
          ...updatedQuestions[currentQuestionIndex],
          userAnswer: value,
          isVisited: true,
        }
        return {
          ...prev,
          questions: updatedQuestions,
        }
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
    [testState, saveProgress],
  )

  // Add a new function to clear responses
  const handleClearResponse = useCallback(() => {
    const { questions, currentQuestionIndex } = testState
    if (questions.length === 0) return

    setTestState((prev) => {
      const updatedQuestions = [...prev.questions]
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

      return {
        ...prev,
        questions: updatedQuestions,
      }
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
  }, [testState, saveProgress])

  const handleMarkForReview = useCallback(() => {
    const { questions, currentQuestionIndex } = testState
    if (questions.length === 0) return

    setTestState((prev) => {
      const updatedQuestions = [...prev.questions]
      updatedQuestions[currentQuestionIndex] = {
        ...updatedQuestions[currentQuestionIndex],
        isMarkedForReview: !updatedQuestions[currentQuestionIndex].isMarkedForReview,
        isVisited: true,
      }
      return {
        ...prev,
        questions: updatedQuestions,
      }
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
  }, [testState, saveProgress])

  // Fix the time tracking logic by resetting the question start time when changing questions
  const goToQuestion = useCallback(
    (index: number) => {
      const { questions, currentQuestionIndex, questionStartTime, testConfig } = testState
      if (index < 0 || index >= questions.length) return

      // Save the current question state before navigating
      const currentQuestionData = currentQuestionRef.current || questions[currentQuestionIndex]

      // Update time spent on current question before changing
      if (questionStartTime) {
        const now = new Date()
        const timeSpent = Math.floor((now.getTime() - questionStartTime.getTime()) / 1000)

        // Only add the time if it's reasonable (less than the total test time)
        const reasonableTime = Math.min(timeSpent, testConfig?.timeInMinutes * 60 || 3600)

        setTestState((prev) => {
          const updatedQuestions = [...prev.questions]

          // Always ensure question 1 is marked as visited
          if (updatedQuestions[0]) {
            updatedQuestions[0] = {
              ...updatedQuestions[0],
              isVisited: true,
            }
          }

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

          return {
            ...prev,
            questions: updatedQuestions,
            currentQuestionIndex: index,
            questionStartTime: new Date(),
          }
        })
      } else {
        // If no questionStartTime, still mark questions as visited
        setTestState((prev) => {
          const updatedQuestions = [...prev.questions]

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

          // Make sure question 1 is always marked as visited
          if (updatedQuestions[0]) {
            updatedQuestions[0].isVisited = true
          }

          return {
            ...prev,
            questions: updatedQuestions,
            currentQuestionIndex: index,
            questionStartTime: new Date(),
          }
        })
      }

      // Save progress after state updates
      setTimeout(() => saveProgress(false), 0)
    },
    [testState, saveProgress],
  )

  const handleSubmitTest = async () => {
    const {
      testConfig,
      questions,
      currentQuestionIndex,
      questionStartTime,
      testStartTime,
      isScreenshotMode,
      useServerStorage,
    } = testState

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

      setTestState((prev) => {
        const updatedQuestions = [...prev.questions]
        updatedQuestions[currentQuestionIndex].timeSpent += timeSpent
        return {
          ...prev,
          questions: updatedQuestions,
          testSubmitted: true,
        }
      })
    } else {
      setTestState((prev) => ({
        ...prev,
        testSubmitted: true,
      }))
    }

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

  // Add this function right before the return statement:

  // Force question 1 to be marked as visited
  useEffect(() => {
    // This effect runs on every render to ensure question 1 is always marked
    if (testState.questions.length > 0 && !testState.questions[0].isVisited) {
      setTestState((prev) => {
        const updatedQuestions = [...prev.questions]
        updatedQuestions[0] = {
          ...updatedQuestions[0],
          isVisited: true,
        }
        return {
          ...prev,
          questions: updatedQuestions,
        }
      })
    }
  }, [testState.questions])

  const {
    questions,
    currentQuestionIndex,
    timeRemaining,
    isLoading,
    testConfig,
    lastSaved,
    isScreenshotMode,
    showSubmitDialog,
  } = testState

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
      <TestHeader
        timeRemaining={timeRemaining}
        onSubmit={() => setTestState((prev) => ({ ...prev, showSubmitDialog: true }))}
        lastSaved={lastSaved}
      />

      <div className="flex flex-1 p-4">
        <div className="w-3/4 pr-4">
          <Card className="p-6 h-full overflow-auto" key={`question-card-${currentQuestionIndex}`}>
            <div className="flex justify-between mb-4 sticky top-0 bg-background pt-1 pb-3 z-10">
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
                  className="space-y-3"
                >
                  {["A", "B", "C", "D"].map((option, index) => (
                    <div
                      key={`option-${option}-${index}`}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-accent"
                    >
                      <RadioGroupItem id={`option-${option}-${index}`} value={option} />
                      <Label htmlFor={`option-${option}-${index}`} className="cursor-pointer w-full">
                        Option {option}
                      </Label>
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
                      key={`option-${option}-${index}`}
                      className="flex items-center space-x-2 p-2 rounded hover:bg-accent"
                    >
                      <Checkbox
                        id={`option-${option}-${index}`}
                        checked={currentAnswers.includes(option)}
                        onCheckedChange={(checked) => {
                          handleMultipleCorrectAnswerChange(option, checked === true)
                        }}
                      />
                      <Label htmlFor={`option-${option}-${index}`} className="cursor-pointer w-full">
                        Option {option}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}

            {currentQuestion.type === "numerical" && (
              <div className="space-y-2">
                <Label htmlFor="numerical-answer">Enter numerical value:</Label>
                <Input
                  id="numerical-answer"
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

          <Button
            className="w-full mt-4"
            variant="destructive"
            onClick={() => setTestState((prev) => ({ ...prev, showSubmitDialog: true }))}
          >
            Submit Test
          </Button>
        </div>
      </div>

      <AlertDialog
        open={showSubmitDialog}
        onOpenChange={(open) => setTestState((prev) => ({ ...prev, showSubmitDialog: open }))}
      >
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

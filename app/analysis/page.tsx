"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { generatePDF } from "@/lib/pdf-generator"
import { formatTime } from "@/lib/utils"
import {
  BarChart,
  PieChart,
  Download,
  Clock,
  BarChart2,
  FileText,
  Upload,
  Award,
  HelpCircle,
  FileDown,
} from "lucide-react"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  calculateScore,
  validateAnswerKey,
  defaultMarkingScheme,
  sampleAnswerKey,
  type AnswerKey,
  type MarkingScheme,
  type ScoreResult,
} from "@/lib/score-calculator"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Question {
  id: number
  type: string
  text?: string
  userAnswer: string | string[] | null
  isMarkedForReview: boolean
  isVisited: boolean
  timeSpent: number
  visitCount: number
  screenshot?: string | null
}

interface TestConfig {
  numQuestions: number
  timeInMinutes: number
  questionTypes: {
    singleCorrect: boolean
    multipleCorrect: boolean
    numerical: boolean
  }
  isScreenshotMode?: boolean
}

interface TestResults {
  questions: Question[]
  testConfig: TestConfig
  completedAt: string
  startedAt: string
  totalTestTime: number
  isScreenshotMode?: boolean
}

interface QuestionMarkingScheme {
  id: number
  type: string
  marks: {
    correct: number
    incorrect: number
    unanswered: number
  }
}

export default function AnalysisPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { theme } = useTheme()
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null)
  const [markingScheme, setMarkingScheme] = useState<MarkingScheme>(defaultMarkingScheme)
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [questionMarkingSchemes, setQuestionMarkingSchemes] = useState<QuestionMarkingScheme[]>([])
  const [showSampleAnswerKey, setShowSampleAnswerKey] = useState(false)

  useEffect(() => {
    // Get test results from localStorage
    const resultsStr = localStorage.getItem("testResults")

    if (!resultsStr) {
      // Redirect to home page if no test results exist
      router.push("/")
      return
    }

    try {
      const results = JSON.parse(resultsStr)
      setTestResults(results)

      // Initialize question marking schemes
      const singleCorrectQuestions = results.questions.filter((q) => q.type === "singleCorrect")
      const initialSchemes = singleCorrectQuestions.map((q) => ({
        id: q.id,
        type: "singleCorrect",
        marks: { ...markingScheme.singleCorrect.default },
      }))
      setQuestionMarkingSchemes(initialSchemes)
    } catch (error) {
      console.error("Error parsing test results:", error)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const handleDownloadPDF = () => {
    if (testResults) {
      try {
        generatePDF(testResults.questions, testResults.testConfig, testResults.totalTestTime, theme || "light")
      } catch (error) {
        console.error("Error generating PDF:", error)
        toast({
          title: "Error generating PDF",
          description: "There was an error generating the PDF. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleAnswerKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string)

          if (validateAnswerKey(json)) {
            setAnswerKey(json)
            toast({
              title: "Answer key uploaded",
              description: "The answer key has been successfully uploaded.",
            })

            // Calculate score if we have test results
            if (testResults) {
              const result = calculateScore(testResults.questions, json, markingScheme)
              setScoreResult(result)
            }
          } else {
            toast({
              title: "Invalid answer key format",
              description: "The uploaded file does not have the correct format for an answer key.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("Error parsing answer key:", error)
          toast({
            title: "Error parsing answer key",
            description: "There was an error parsing the answer key. Please check the file format.",
            variant: "destructive",
          })
        }
      }

      reader.readAsText(file)
    }
  }

  const handleGlobalMarkingSchemeChange = (section: keyof MarkingScheme, field: string, value: number) => {
    const newMarkingScheme = { ...markingScheme }

    if (section === "singleCorrect") {
      ;(newMarkingScheme.singleCorrect.default as any)[field] = value

      // Update all question marking schemes if global is true
      if (newMarkingScheme.singleCorrect.global) {
        const updatedSchemes = questionMarkingSchemes.map((scheme) => ({
          ...scheme,
          marks: { ...scheme.marks, [field]: value },
        }))
        setQuestionMarkingSchemes(updatedSchemes)
      }
    } else if (section === "numerical") {
      ;(newMarkingScheme.numerical as any)[field] = value
    }

    setMarkingScheme(newMarkingScheme)

    // Recalculate score if we have test results and answer key
    if (testResults && answerKey) {
      const result = calculateScore(testResults.questions, answerKey, newMarkingScheme)
      setScoreResult(result)
    }
  }

  const handleQuestionMarkingSchemeChange = (questionId: number, field: string, value: number) => {
    const updatedSchemes = questionMarkingSchemes.map((scheme) => {
      if (scheme.id === questionId) {
        return {
          ...scheme,
          marks: { ...scheme.marks, [field]: value },
        }
      }
      return scheme
    })

    setQuestionMarkingSchemes(updatedSchemes)

    // Update answer key with question-specific marking schemes
    if (answerKey) {
      const updatedAnswerKey = { ...answerKey }
      updatedSchemes.forEach((scheme) => {
        if (updatedAnswerKey[scheme.id]) {
          updatedAnswerKey[scheme.id] = {
            ...updatedAnswerKey[scheme.id],
            marks: { ...scheme.marks },
          }
        }
      })

      setAnswerKey(updatedAnswerKey)

      // Recalculate score
      if (testResults) {
        const result = calculateScore(testResults.questions, updatedAnswerKey, markingScheme)
        setScoreResult(result)
      }
    }
  }

  const toggleGlobalMarkingScheme = (value: boolean) => {
    const newMarkingScheme = { ...markingScheme }
    newMarkingScheme.singleCorrect.global = value
    setMarkingScheme(newMarkingScheme)

    // Recalculate score if we have test results and answer key
    if (testResults && answerKey) {
      const result = calculateScore(testResults.questions, answerKey, newMarkingScheme)
      setScoreResult(result)
    }
  }

  const downloadSampleAnswerKey = () => {
    const jsonString = JSON.stringify(sampleAnswerKey, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const href = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = href
    link.download = "sample-answer-key.json"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(href)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading analysis...</div>
  }

  if (!testResults) {
    return <div className="flex items-center justify-center min-h-screen">No test results found</div>
  }

  // Calculate statistics
  const totalQuestions = testResults.questions.length
  const answeredQuestions = testResults.questions.filter(
    (q) => q.userAnswer !== null && (!Array.isArray(q.userAnswer) || q.userAnswer.length > 0),
  ).length
  const markedForReview = testResults.questions.filter((q) => q.isMarkedForReview).length
  const notAnswered = totalQuestions - answeredQuestions

  // Calculate question type statistics
  const singleCorrectQuestions = testResults.questions.filter((q) => q.type === "singleCorrect").length
  const multipleCorrectQuestions = testResults.questions.filter((q) => q.type === "multipleCorrect").length
  const numericalQuestions = testResults.questions.filter((q) => q.type === "numerical").length

  // Calculate answered by type
  const singleCorrectAnswered = testResults.questions.filter(
    (q) => q.type === "singleCorrect" && q.userAnswer !== null,
  ).length
  const multipleCorrectAnswered = testResults.questions.filter(
    (q) => q.type === "multipleCorrect" && Array.isArray(q.userAnswer) && q.userAnswer.length > 0,
  ).length
  const numericalAnswered = testResults.questions.filter((q) => q.type === "numerical" && q.userAnswer !== null).length

  // Calculate time statistics
  const totalTimeSpent = testResults.totalTestTime
  const averageTimePerQuestion = totalTimeSpent / totalQuestions
  const averageTimePerAnsweredQuestion = answeredQuestions > 0 ? totalTimeSpent / answeredQuestions : 0

  // Find questions that took the most and least time
  const sortedByTime = [...testResults.questions].sort((a, b) => b.timeSpent - a.timeSpent)
  const longestQuestion = sortedByTime[0]
  const shortestAnsweredQuestion = [...testResults.questions]
    .filter((q) => q.userAnswer !== null && (!Array.isArray(q.userAnswer) || q.userAnswer.length > 0))
    .sort((a, b) => a.timeSpent - b.timeSpent)[0]

  return (
    <div className="container py-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Test Analysis</h1>
          <p className="text-muted-foreground">Completed on {new Date(testResults.completedAt).toLocaleString()}</p>
        </div>
        <Button onClick={handleDownloadPDF} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalQuestions}</div>
            <div className="text-sm text-muted-foreground mt-1">Questions in the test</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-4 w-4 text-green-500" />
              Answered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{answeredQuestions}</div>
            <Progress className="mt-2" value={(answeredQuestions / totalQuestions) * 100} />
            <div className="text-sm text-muted-foreground mt-1">
              {Math.round((answeredQuestions / totalQuestions) * 100)}% completion rate
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-red-500" />
              Not Answered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{notAnswered}</div>
            <Progress className="mt-2" value={(notAnswered / totalQuestions) * 100} />
            <div className="text-sm text-muted-foreground mt-1">
              {Math.round((notAnswered / totalQuestions) * 100)}% unanswered
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Time Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{formatTime(totalTimeSpent)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {Math.round((totalTimeSpent / (testResults.testConfig.timeInMinutes * 60)) * 100)}% of allotted time
            </div>
          </CardContent>
        </Card>
      </div>

      {scoreResult && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Score Analysis
            </CardTitle>
            <CardDescription>Your score based on the uploaded answer key</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="text-4xl font-bold text-center">
                  {scoreResult.totalScore}{" "}
                  <span className="text-lg text-muted-foreground">/ {scoreResult.totalMaxScore}</span>
                </div>
                <Progress value={(scoreResult.totalScore / scoreResult.totalMaxScore) * 100} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  {Math.round((scoreResult.totalScore / scoreResult.totalMaxScore) * 100)}%
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Section Scores</h3>
                {singleCorrectQuestions > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Single Correct:</span>
                    <span className="font-medium">
                      {scoreResult.sectionScores.singleCorrect.score} /{" "}
                      {scoreResult.sectionScores.singleCorrect.maxScore}
                    </span>
                  </div>
                )}
                {multipleCorrectQuestions > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Multiple Correct:</span>
                    <span className="font-medium">
                      {scoreResult.sectionScores.multipleCorrect.score} /{" "}
                      {scoreResult.sectionScores.multipleCorrect.maxScore}
                    </span>
                  </div>
                )}
                {numericalQuestions > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Numerical:</span>
                    <span className="font-medium">
                      {scoreResult.sectionScores.numerical.score} / {scoreResult.sectionScores.numerical.maxScore}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Correct/Incorrect</h3>
                <div className="flex justify-between text-sm">
                  <span>Correct Answers:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {scoreResult.sectionScores.singleCorrect.correct +
                      scoreResult.sectionScores.multipleCorrect.allCorrect +
                      scoreResult.sectionScores.numerical.correct}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Incorrect Answers:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {scoreResult.sectionScores.singleCorrect.incorrect +
                      scoreResult.sectionScores.multipleCorrect.anyIncorrect +
                      scoreResult.sectionScores.numerical.incorrect}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Partially Correct:</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {scoreResult.sectionScores.multipleCorrect.partialCorrect.allCorrectOptionsThreeMarked +
                      scoreResult.sectionScores.multipleCorrect.partialCorrect.twoCorrectOptionsMarked +
                      scoreResult.sectionScores.multipleCorrect.partialCorrect.oneCorrectOptionMarked}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="summary">
        <TabsList className="mb-4">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="time" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time Analysis
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Question Analysis
          </TabsTrigger>
          <TabsTrigger value="score" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Score
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Test Summary</CardTitle>
              <CardDescription>Overview of your test performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Test Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-sm text-muted-foreground">Time Allotted</div>
                      <div className="font-medium">{formatTime(testResults.testConfig.timeInMinutes * 60)}</div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-sm text-muted-foreground">Question Types</div>
                      <div className="font-medium">
                        {[
                          testResults.testConfig.questionTypes?.singleCorrect ? "Single Correct" : null,
                          testResults.testConfig.questionTypes?.multipleCorrect ? "Multiple Correct" : null,
                          testResults.testConfig.questionTypes?.numerical ? "Numerical" : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Custom configuration"}
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-sm text-muted-foreground">Marked for Review</div>
                      <div className="font-medium">{markedForReview}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Question Type Breakdown</h3>
                  <div className="space-y-3">
                    {singleCorrectQuestions > 0 && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>
                            Single Correct ({singleCorrectAnswered}/{singleCorrectQuestions})
                          </span>
                          <span>{Math.round((singleCorrectAnswered / singleCorrectQuestions) * 100)}%</span>
                        </div>
                        <Progress value={(singleCorrectAnswered / singleCorrectQuestions) * 100} />
                      </div>
                    )}

                    {multipleCorrectQuestions > 0 && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>
                            Multiple Correct ({multipleCorrectAnswered}/{multipleCorrectQuestions})
                          </span>
                          <span>{Math.round((multipleCorrectAnswered / multipleCorrectQuestions) * 100)}%</span>
                        </div>
                        <Progress value={(multipleCorrectAnswered / multipleCorrectQuestions) * 100} />
                      </div>
                    )}

                    {numericalQuestions > 0 && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>
                            Numerical ({numericalAnswered}/{numericalQuestions})
                          </span>
                          <span>{Math.round((numericalAnswered / numericalQuestions) * 100)}%</span>
                        </div>
                        <Progress value={(numericalAnswered / numericalQuestions) * 100} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle>Time Analysis</CardTitle>
              <CardDescription>Detailed breakdown of time spent on questions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Average Time per Question</div>
                    <div className="font-medium">{formatTime(Math.round(averageTimePerQuestion))}</div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Average Time per Answered Question</div>
                    <div className="font-medium">{formatTime(Math.round(averageTimePerAnsweredQuestion))}</div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground">Total Time Spent</div>
                    <div className="font-medium">{formatTime(totalTimeSpent)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Time Distribution</h3>
                  <div className="space-y-4">
                    {longestQuestion && (
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-sm font-medium">Question that took the most time:</div>
                        <div className="flex justify-between mt-1">
                          <span>Question {longestQuestion.id}</span>
                          <span>{formatTime(longestQuestion.timeSpent)}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Type: {longestQuestion.type}, Visits: {longestQuestion.visitCount}
                        </div>
                      </div>
                    )}

                    {shortestAnsweredQuestion && (
                      <div className="bg-muted p-3 rounded-md">
                        <div className="text-sm font-medium">Answered question that took the least time:</div>
                        <div className="flex justify-between mt-1">
                          <span>Question {shortestAnsweredQuestion.id}</span>
                          <span>{formatTime(shortestAnsweredQuestion.timeSpent)}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Type: {shortestAnsweredQuestion.type}, Visits: {shortestAnsweredQuestion.visitCount}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Time Spent by Question</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {testResults.questions.map((question) => (
                      <div key={question.id} className="flex items-center">
                        <div className="w-24">Question {question.id}</div>
                        <div className="flex-1">
                          <Progress value={(question.timeSpent / longestQuestion.timeSpent) * 100} />
                        </div>
                        <div className="w-24 text-right">{formatTime(question.timeSpent)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>Question Analysis</CardTitle>
              <CardDescription>Detailed breakdown of your responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.questions.map((question, index) => (
                  <div key={question.id} className="border-b pb-4 last:border-b-0">
                    <div className="flex justify-between">
                      <div className="font-medium">Question {index + 1}</div>
                      <div
                        className={`text-sm ${question.userAnswer ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {question.userAnswer ? "Answered" : "Not Answered"}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">Type: {question.type}</div>

                    {testResults.isScreenshotMode && question.screenshot && (
                      <div className="mt-2 mb-2">
                        <Image
                          src={question.screenshot || "/placeholder.svg"}
                          alt={`Question ${index + 1}`}
                          width={300}
                          height={200}
                          className="rounded-md border"
                        />
                      </div>
                    )}

                    <div className="mt-1">
                      <span className="text-sm font-medium">Your Answer: </span>
                      <span>
                        {question.userAnswer === null
                          ? "Not answered"
                          : Array.isArray(question.userAnswer)
                            ? question.userAnswer.join(", ")
                            : question.userAnswer}
                      </span>
                    </div>

                    {scoreResult && scoreResult.questionScores[question.id] && (
                      <>
                        <div className="mt-1">
                          <span className="text-sm font-medium">Correct Answer: </span>
                          <span>
                            {Array.isArray(scoreResult.questionScores[question.id].correctAnswer)
                              ? scoreResult.questionScores[question.id].correctAnswer.join(", ")
                              : scoreResult.questionScores[question.id].correctAnswer}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className="text-sm font-medium">Score: </span>
                          <span
                            className={`ml-2 text-sm ${
                              scoreResult.questionScores[question.id].score > 0
                                ? "text-green-600 dark:text-green-400"
                                : scoreResult.questionScores[question.id].score < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {scoreResult.questionScores[question.id].score > 0 && "+"}
                            {scoreResult.questionScores[question.id].score} points
                            {scoreResult.questionScores[question.id].score < 0 && " (Negative marking)"}
                            {scoreResult.questionScores[question.id].score === 0 &&
                              (question.userAnswer === null ? " (Not attempted)" : " (No marks)")}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between mt-1 text-sm">
                      <span>Time spent: {formatTime(question.timeSpent)}</span>
                      <span>Visits: {question.visitCount}</span>
                    </div>
                    {question.isMarkedForReview && (
                      <div className="mt-1 text-sm text-purple-600 dark:text-purple-400">Marked for review</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="score">
          <Card>
            <CardHeader>
              <CardTitle>Score Analysis</CardTitle>
              <CardDescription>Upload answer key and set marking scheme to calculate your score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Upload Answer Key</h3>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Answer Key (JSON)
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="application/json"
                      className="hidden"
                      onChange={handleAnswerKeyUpload}
                    />

                    <Button variant="outline" onClick={downloadSampleAnswerKey} className="flex items-center gap-2">
                      <FileDown className="h-4 w-4" />
                      Download Sample
                    </Button>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>
                            Upload a JSON file with the correct answers for each question. Click "Download Sample" to
                            see the expected format.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {answerKey && (
                      <span className="text-sm text-green-600 dark:text-green-400">
                        Answer key uploaded ({Object.keys(answerKey).length} questions)
                      </span>
                    )}
                  </div>

                  <Dialog open={showSampleAnswerKey} onOpenChange={setShowSampleAnswerKey}>
                    <DialogTrigger asChild>
                      <Button variant="link" className="p-0 h-auto mt-2">
                        View sample answer key format
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Sample Answer Key Format</DialogTitle>
                        <DialogDescription>This is the expected format for the answer key JSON file.</DialogDescription>
                      </DialogHeader>
                      <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                        {JSON.stringify(sampleAnswerKey, null, 2)}
                      </pre>
                    </DialogContent>
                  </Dialog>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium mb-4">Marking Scheme</h3>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium">Single Correct Questions</h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">Use same marking for all questions</span>
                          <Switch
                            checked={markingScheme.singleCorrect.global}
                            onCheckedChange={toggleGlobalMarkingScheme}
                          />
                        </div>
                      </div>

                      {markingScheme.singleCorrect.global ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="singleCorrect-correct">Correct Answer</Label>
                            <Input
                              id="singleCorrect-correct"
                              type="number"
                              value={markingScheme.singleCorrect.default.correct}
                              onChange={(e) =>
                                handleGlobalMarkingSchemeChange("singleCorrect", "correct", Number(e.target.value))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="singleCorrect-incorrect">Incorrect Answer</Label>
                            <Input
                              id="singleCorrect-incorrect"
                              type="number"
                              value={markingScheme.singleCorrect.default.incorrect}
                              onChange={(e) =>
                                handleGlobalMarkingSchemeChange("singleCorrect", "incorrect", Number(e.target.value))
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="singleCorrect-unanswered">Unanswered</Label>
                            <Input
                              id="singleCorrect-unanswered"
                              type="number"
                              value={markingScheme.singleCorrect.default.unanswered}
                              onChange={(e) =>
                                handleGlobalMarkingSchemeChange("singleCorrect", "unanswered", Number(e.target.value))
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-4 gap-4 font-medium text-sm">
                            <div>Question</div>
                            <div>Correct</div>
                            <div>Incorrect</div>
                            <div>Unanswered</div>
                          </div>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {questionMarkingSchemes.map((scheme) => (
                              <div key={scheme.id} className="grid grid-cols-4 gap-4">
                                <div className="flex items-center">Question {scheme.id}</div>
                                <div>
                                  <Input
                                    type="number"
                                    value={scheme.marks.correct}
                                    onChange={(e) =>
                                      handleQuestionMarkingSchemeChange(scheme.id, "correct", Number(e.target.value))
                                    }
                                  />
                                </div>
                                <div>
                                  <Input
                                    type="number"
                                    value={scheme.marks.incorrect}
                                    onChange={(e) =>
                                      handleQuestionMarkingSchemeChange(scheme.id, "incorrect", Number(e.target.value))
                                    }
                                  />
                                </div>
                                <div>
                                  <Input
                                    type="number"
                                    value={scheme.marks.unanswered}
                                    onChange={(e) =>
                                      handleQuestionMarkingSchemeChange(scheme.id, "unanswered", Number(e.target.value))
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium">Multiple Correct Questions</h4>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <HelpCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>The marking scheme for multiple correct questions is fixed as per JEE guidelines.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                        <p>+4: All correct options are chosen</p>
                        <p>+3: All four options are correct but only three options are chosen</p>
                        <p>+2: Three or more options are correct but only two options are chosen (both correct)</p>
                        <p>+1: Two or more options are correct but only one option is chosen (and it's correct)</p>
                        <p>0: Question is unanswered</p>
                        <p>-2: Any incorrect option is selected</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Numerical Questions</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="numerical-correct">Correct Answer</Label>
                          <Input
                            id="numerical-correct"
                            type="number"
                            value={markingScheme.numerical.correct}
                            onChange={(e) =>
                              handleGlobalMarkingSchemeChange("numerical", "correct", Number(e.target.value))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="numerical-incorrect">Incorrect Answer</Label>
                          <Input
                            id="numerical-incorrect"
                            type="number"
                            value={markingScheme.numerical.incorrect}
                            onChange={(e) =>
                              handleGlobalMarkingSchemeChange("numerical", "incorrect", Number(e.target.value))
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="numerical-unanswered">Unanswered</Label>
                          <Input
                            id="numerical-unanswered"
                            type="number"
                            value={markingScheme.numerical.unanswered}
                            onChange={(e) =>
                              handleGlobalMarkingSchemeChange("numerical", "unanswered", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {scoreResult && (
                  <>
                    <Separator />

                    <div>
                      <h3 className="font-medium mb-4">Score Details</h3>

                      <Table>
                        <TableCaption>Detailed score breakdown by question type</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Question Type</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Correct</TableHead>
                            <TableHead>Incorrect</TableHead>
                            <TableHead>Partial</TableHead>
                            <TableHead>Unanswered</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {singleCorrectQuestions > 0 && (
                            <TableRow>
                              <TableCell>Single Correct</TableCell>
                              <TableCell>{singleCorrectQuestions}</TableCell>
                              <TableCell>{scoreResult.sectionScores.singleCorrect.correct}</TableCell>
                              <TableCell>{scoreResult.sectionScores.singleCorrect.incorrect}</TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>{scoreResult.sectionScores.singleCorrect.unanswered}</TableCell>
                              <TableCell className="text-right font-medium">
                                {scoreResult.sectionScores.singleCorrect.score}
                              </TableCell>
                            </TableRow>
                          )}

                          {multipleCorrectQuestions > 0 && (
                            <TableRow>
                              <TableCell>Multiple Correct</TableCell>
                              <TableCell>{multipleCorrectQuestions}</TableCell>
                              <TableCell>{scoreResult.sectionScores.multipleCorrect.allCorrect}</TableCell>
                              <TableCell>{scoreResult.sectionScores.multipleCorrect.anyIncorrect}</TableCell>
                              <TableCell>
                                {scoreResult.sectionScores.multipleCorrect.partialCorrect.allCorrectOptionsThreeMarked +
                                  scoreResult.sectionScores.multipleCorrect.partialCorrect.twoCorrectOptionsMarked +
                                  scoreResult.sectionScores.multipleCorrect.partialCorrect.oneCorrectOptionMarked}
                              </TableCell>
                              <TableCell>{scoreResult.sectionScores.multipleCorrect.unanswered}</TableCell>
                              <TableCell className="text-right font-medium">
                                {scoreResult.sectionScores.multipleCorrect.score}
                              </TableCell>
                            </TableRow>
                          )}

                          {numericalQuestions > 0 && (
                            <TableRow>
                              <TableCell>Numerical</TableCell>
                              <TableCell>{numericalQuestions}</TableCell>
                              <TableCell>{scoreResult.sectionScores.numerical.correct}</TableCell>
                              <TableCell>{scoreResult.sectionScores.numerical.incorrect}</TableCell>
                              <TableCell>-</TableCell>
                              <TableCell>{scoreResult.sectionScores.numerical.unanswered}</TableCell>
                              <TableCell className="text-right font-medium">
                                {scoreResult.sectionScores.numerical.score}
                              </TableCell>
                            </TableRow>
                          )}

                          <TableRow className="font-medium">
                            <TableCell>Total</TableCell>
                            <TableCell>{totalQuestions}</TableCell>
                            <TableCell>
                              {scoreResult.sectionScores.singleCorrect.correct +
                                scoreResult.sectionScores.multipleCorrect.allCorrect +
                                scoreResult.sectionScores.numerical.correct}
                            </TableCell>
                            <TableCell>
                              {scoreResult.sectionScores.singleCorrect.incorrect +
                                scoreResult.sectionScores.multipleCorrect.anyIncorrect +
                                scoreResult.sectionScores.numerical.incorrect}
                            </TableCell>
                            <TableCell>
                              {scoreResult.sectionScores.multipleCorrect.partialCorrect.allCorrectOptionsThreeMarked +
                                scoreResult.sectionScores.multipleCorrect.partialCorrect.twoCorrectOptionsMarked +
                                scoreResult.sectionScores.multipleCorrect.partialCorrect.oneCorrectOptionMarked}
                            </TableCell>
                            <TableCell>
                              {scoreResult.sectionScores.singleCorrect.unanswered +
                                scoreResult.sectionScores.multipleCorrect.unanswered +
                                scoreResult.sectionScores.numerical.unanswered}
                            </TableCell>
                            <TableCell className="text-right">{scoreResult.totalScore}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-center">
        <Button onClick={() => router.push("/")} variant="outline" className="mr-4">
          Return to Home
        </Button>
        <Button onClick={handleDownloadPDF}>Download PDF Report</Button>
      </div>
    </div>
  )
}

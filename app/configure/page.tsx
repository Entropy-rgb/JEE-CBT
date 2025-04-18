"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertCircle, Upload, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThemeToggle } from "@/components/theme-toggle"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { StorageService } from "@/lib/storage-service"
import Image from "next/image"

export default function ConfigurePage() {
  const router = useRouter()
  const [numQuestions, setNumQuestions] = useState<number>(30)
  const [timeInMinutes, setTimeInMinutes] = useState<number>(60)
  const [questionTypes, setQuestionTypes] = useState({
    singleCorrect: true,
    multipleCorrect: false,
    numerical: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("basic")

  // Add this useEffect to handle tab changes and initialize question types
  useEffect(() => {
    if (activeTab === "advanced" && specificQuestionTypes.length === 0) {
      initializeQuestionTypes(numQuestions)
    }
  }, [activeTab, numQuestions])

  const [specificQuestionTypes, setSpecificQuestionTypes] = useState<
    Array<"singleCorrect" | "multipleCorrect" | "numerical">
  >([])
  const [isScreenshotMode, setIsScreenshotMode] = useState<boolean>(false)
  const [useServerStorage, setUseServerStorage] = useState<boolean>(true)
  const [screenshots, setScreenshots] = useState<(string | null)[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize question types when number of questions changes
  const initializeQuestionTypes = (count: number) => {
    const types: Array<"singleCorrect" | "multipleCorrect" | "numerical"> = []
    for (let i = 0; i < count; i++) {
      types.push("singleCorrect") // Default to single correct
    }
    setSpecificQuestionTypes(types)

    // Also initialize screenshots array
    setScreenshots(Array(count).fill(null))
  }

  // Update question types when number changes
  const handleNumQuestionsChange = (value: number) => {
    setNumQuestions(value)

    // Always initialize question types when number changes, regardless of active tab
    initializeQuestionTypes(value)
  }

  // Handle changing a specific question's type
  const handleQuestionTypeChange = (index: number, type: "singleCorrect" | "multipleCorrect" | "numerical") => {
    const newTypes = [...specificQuestionTypes]
    newTypes[index] = type
    setSpecificQuestionTypes(newTypes)
  }

  // Set all questions to a specific type
  const setAllQuestionsToType = (type: "singleCorrect" | "multipleCorrect" | "numerical") => {
    const newTypes = specificQuestionTypes.map(() => type)
    setSpecificQuestionTypes(newTypes)
  }

  // Handle screenshot upload for a specific question
  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const fileUrl = URL.createObjectURL(file)

      const newScreenshots = [...screenshots]
      newScreenshots[index] = fileUrl
      setScreenshots(newScreenshots)

      // Update progress
      const uploadedCount = newScreenshots.filter((s) => s !== null).length
      setUploadProgress((uploadedCount / numQuestions) * 100)
    }
  }

  // Handle bulk screenshot upload
  const handleBulkScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true)
      const files = Array.from(e.target.files)
      const newScreenshots = [...screenshots]

      // Process each file
      files.forEach((file, i) => {
        if (i < numQuestions) {
          const fileUrl = URL.createObjectURL(file)
          newScreenshots[i] = fileUrl
        }
      })

      setScreenshots(newScreenshots)

      // Update progress
      const uploadedCount = newScreenshots.filter((s) => s !== null).length
      setUploadProgress((uploadedCount / numQuestions) * 100)
      setIsUploading(false)
    }
  }

  // Remove a screenshot
  const removeScreenshot = (index: number) => {
    const newScreenshots = [...screenshots]
    newScreenshots[index] = null
    setScreenshots(newScreenshots)

    // Update progress
    const uploadedCount = newScreenshots.filter((s) => s !== null).length
    setUploadProgress((uploadedCount / numQuestions) * 100)
  }

  const handleStartTest = () => {
    // Validate inputs
    if (numQuestions <= 0) {
      setError("Number of questions must be greater than 0")
      return
    }

    if (timeInMinutes <= 0) {
      setError("Time must be greater than 0 minutes")
      return
    }

    if (
      activeTab === "basic" &&
      !questionTypes.singleCorrect &&
      !questionTypes.multipleCorrect &&
      !questionTypes.numerical
    ) {
      setError("Please select at least one question type")
      return
    }

    // If screenshot mode is enabled, check if screenshots are uploaded
    if (isScreenshotMode) {
      const uploadedCount = screenshots.filter((s) => s !== null).length
      if (uploadedCount === 0) {
        setError("Please upload at least one screenshot")
        return
      }
    }

    // Create test configuration
    const testConfig = {
      numQuestions,
      timeInMinutes,
      questionTypes: activeTab === "basic" ? questionTypes : null,
      specificQuestionTypes: activeTab === "advanced" ? specificQuestionTypes : null,
      configType: activeTab,
      isScreenshotMode,
      useServerStorage,
      screenshots: isScreenshotMode ? screenshots : null,
    }

    // Store test configuration in localStorage
    localStorage.setItem("testConfig", JSON.stringify(testConfig))

    // Clear any existing test progress
    StorageService.clearData({ useServerStorage }).then(() => {
      // Navigate to test page
      router.push("/test")
    })
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Configure Your Test</CardTitle>
          <CardDescription>Set up your practice test parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="numQuestions">Number of Questions</Label>
              <Input
                id="numQuestions"
                type="number"
                min="1"
                value={numQuestions}
                onChange={(e) => handleNumQuestionsChange(Number.parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeInMinutes">Time (in minutes)</Label>
              <Input
                id="timeInMinutes"
                type="number"
                min="1"
                value={timeInMinutes}
                onChange={(e) => setTimeInMinutes(Number.parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="screenshotMode">Screenshot Mode</Label>
                <p className="text-sm text-muted-foreground">Upload question images instead of using text references</p>
              </div>
              <Switch id="screenshotMode" checked={isScreenshotMode} onCheckedChange={setIsScreenshotMode} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="serverStorage">Enable Server Storage</Label>
                <p className="text-sm text-muted-foreground">
                  Save progress to server (simulated) for better reliability
                </p>
              </div>
              <Switch id="serverStorage" checked={useServerStorage} onCheckedChange={setUseServerStorage} />
            </div>
          </div>

          {isScreenshotMode && (
            <div className="space-y-4 border p-4 rounded-md">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Upload Question Screenshots</h3>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleBulkScreenshotUpload}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto p-2">
                {screenshots.map((screenshot, index) => (
                  <div key={index} className="relative border rounded-md p-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Question {index + 1}</span>
                      <input
                        type="file"
                        id={`screenshot-${index}`}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleScreenshotUpload(e, index)}
                      />
                      {screenshot ? (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeScreenshot(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => document.getElementById(`screenshot-${index}`)?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {screenshot ? (
                      <div className="relative h-24 w-full">
                        <Image
                          src={screenshot || "/placeholder.svg"}
                          alt={`Question ${index + 1}`}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                    ) : (
                      <div
                        className="h-24 w-full flex items-center justify-center border-2 border-dashed rounded cursor-pointer"
                        onClick={() => document.getElementById(`screenshot-${index}`)?.click()}
                      >
                        <span className="text-sm text-muted-foreground">Click to upload</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Configuration</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="space-y-3">
                <Label>Question Types</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="singleCorrect"
                      checked={questionTypes.singleCorrect}
                      onCheckedChange={(checked) =>
                        setQuestionTypes({ ...questionTypes, singleCorrect: checked === true })
                      }
                    />
                    <Label htmlFor="singleCorrect">Single Correct Option</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multipleCorrect"
                      checked={questionTypes.multipleCorrect}
                      onCheckedChange={(checked) =>
                        setQuestionTypes({ ...questionTypes, multipleCorrect: checked === true })
                      }
                    />
                    <Label htmlFor="multipleCorrect">Multiple Correct Options</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="numerical"
                      checked={questionTypes.numerical}
                      onCheckedChange={(checked) => setQuestionTypes({ ...questionTypes, numerical: checked === true })}
                    />
                    <Label htmlFor="numerical">Numerical Value</Label>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  In basic mode, question types will be distributed evenly throughout the test.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Specify Question Types</Label>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setAllQuestionsToType("singleCorrect")}>
                      All Single
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAllQuestionsToType("multipleCorrect")}>
                      All Multiple
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAllQuestionsToType("numerical")}>
                      All Numerical
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question #</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {specificQuestionTypes.map((type, index) => (
                        <TableRow key={index}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Select
                              value={type}
                              onValueChange={(value) =>
                                handleQuestionTypeChange(
                                  index,
                                  value as "singleCorrect" | "multipleCorrect" | "numerical",
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="singleCorrect">Single Correct</SelectItem>
                                <SelectItem value="multipleCorrect">Multiple Correct</SelectItem>
                                <SelectItem value="numerical">Numerical</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  In advanced mode, you can specify the type for each individual question.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleStartTest}>
            Start Test
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

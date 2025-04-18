import jsPDF from "jspdf"
import { formatTime } from "./utils"
import "jspdf-autotable"

// Add the autotable plugin type
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

interface Question {
  id: number
  type: string
  text?: string
  userAnswer: string | string[] | null
  isMarkedForReview: boolean
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
}

export function generatePDF(
  questions: Question[],
  testConfig: TestConfig | null,
  totalTestTime: number,
  theme = "light",
) {
  // Return early if testConfig is null
  if (!testConfig) {
    console.error("Cannot generate PDF: Test configuration is missing")
    return
  }

  try {
    // Set colors based on theme
    const textColor = theme === "dark" ? "#ffffff" : "#000000"
    const backgroundColor = theme === "dark" ? "#1a1a1a" : "#ffffff"
    const accentColor = "#3b82f6" // Blue
    const successColor = "#22c55e" // Green
    const warningColor = "#f59e0b" // Amber
    const dangerColor = "#ef4444" // Red

    const doc = new jsPDF()

    // Add title with styling
    doc.setFillColor(accentColor)
    doc.rect(0, 0, doc.internal.pageSize.width, 40, "F")
    doc.setTextColor("#ffffff")
    doc.setFontSize(24)
    doc.setFont("helvetica", "bold")
    doc.text("JEE CBT Practice Test Results", 105, 25, { align: "center" })

    // Add test information
    doc.setTextColor(textColor)
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50)
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, 20, 57)
    doc.text(`Number of Questions: ${testConfig.numQuestions}`, 20, 64)
    doc.text(`Time Allotted: ${formatTime(testConfig.timeInMinutes * 60)}`, 20, 71)
    doc.text(`Time Spent: ${formatTime(totalTestTime)}`, 20, 78)

    // Add question types
    const questionTypes = []
    if (testConfig.questionTypes?.singleCorrect) questionTypes.push("Single Correct")
    if (testConfig.questionTypes?.multipleCorrect) questionTypes.push("Multiple Correct")
    if (testConfig.questionTypes?.numerical) questionTypes.push("Numerical")
    doc.text(`Question Types: ${questionTypes.join(", ") || "Custom configuration"}`, 20, 85)

    // Add summary statistics
    doc.setFillColor(accentColor)
    doc.rect(0, 95, doc.internal.pageSize.width, 10, "F")
    doc.setTextColor("#ffffff")
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Test Summary", 105, 102, { align: "center" })

    doc.setTextColor(textColor)
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")

    const totalQuestions = questions.length
    const answeredQuestions = questions.filter(
      (q) => q.userAnswer !== null && (!Array.isArray(q.userAnswer) || q.userAnswer.length > 0),
    ).length
    const markedForReview = questions.filter((q) => q.isMarkedForReview).length

    // Create a summary table
    doc.autoTable({
      startY: 110,
      head: [["Metric", "Value", "Percentage"]],
      body: [
        ["Total Questions", totalQuestions.toString(), "100%"],
        [
          "Questions Answered",
          answeredQuestions.toString(),
          `${Math.round((answeredQuestions / totalQuestions) * 100)}%`,
        ],
        [
          "Questions Not Answered",
          (totalQuestions - answeredQuestions).toString(),
          `${Math.round(((totalQuestions - answeredQuestions) / totalQuestions) * 100)}%`,
        ],
        [
          "Questions Marked for Review",
          markedForReview.toString(),
          `${Math.round((markedForReview / totalQuestions) * 100)}%`,
        ],
      ],
      theme: theme === "dark" ? "grid" : "striped",
      headStyles: {
        fillColor: accentColor,
        textColor: "#ffffff",
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: theme === "dark" ? "#2a2a2a" : "#f8f9fa",
      },
    })

    // Add time analysis
    doc.setFillColor(accentColor)
    doc.rect(0, doc.autoTable.previous.finalY + 10, doc.internal.pageSize.width, 10, "F")
    doc.setTextColor("#ffffff")
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Time Analysis", 105, doc.autoTable.previous.finalY + 17, { align: "center" })

    // Calculate time statistics
    const averageTimePerQuestion = totalTestTime / totalQuestions
    const averageTimePerAnsweredQuestion = answeredQuestions > 0 ? totalTestTime / answeredQuestions : 0

    // Create a time analysis table
    doc.autoTable({
      startY: doc.autoTable.previous.finalY + 25,
      head: [["Metric", "Value"]],
      body: [
        ["Total Time Spent", formatTime(totalTestTime)],
        ["Average Time per Question", formatTime(Math.round(averageTimePerQuestion))],
        ["Average Time per Answered Question", formatTime(Math.round(averageTimePerAnsweredQuestion))],
        ["Time Utilization", `${Math.round((totalTestTime / (testConfig.timeInMinutes * 60)) * 100)}%`],
      ],
      theme: theme === "dark" ? "grid" : "striped",
      headStyles: {
        fillColor: accentColor,
        textColor: "#ffffff",
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: theme === "dark" ? "#2a2a2a" : "#f8f9fa",
      },
    })

    // Add question type analysis
    doc.addPage()
    doc.setFillColor(accentColor)
    doc.rect(0, 0, doc.internal.pageSize.width, 10, "F")
    doc.setTextColor("#ffffff")
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Question Type Analysis", 105, 7, { align: "center" })

    // Calculate question type statistics
    const singleCorrectQuestions = questions.filter((q) => q.type === "singleCorrect").length
    const multipleCorrectQuestions = questions.filter((q) => q.type === "multipleCorrect").length
    const numericalQuestions = questions.filter((q) => q.type === "numerical").length

    // Calculate answered by type
    const singleCorrectAnswered = questions.filter((q) => q.type === "singleCorrect" && q.userAnswer !== null).length
    const multipleCorrectAnswered = questions.filter(
      (q) => q.type === "multipleCorrect" && Array.isArray(q.userAnswer) && q.userAnswer.length > 0,
    ).length
    const numericalAnswered = questions.filter((q) => q.type === "numerical" && q.userAnswer !== null).length

    // Create a question type analysis table
    const questionTypeData = []

    if (singleCorrectQuestions > 0) {
      questionTypeData.push([
        "Single Correct",
        singleCorrectQuestions.toString(),
        singleCorrectAnswered.toString(),
        `${Math.round((singleCorrectAnswered / singleCorrectQuestions) * 100)}%`,
      ])
    }

    if (multipleCorrectQuestions > 0) {
      questionTypeData.push([
        "Multiple Correct",
        multipleCorrectQuestions.toString(),
        multipleCorrectAnswered.toString(),
        `${Math.round((multipleCorrectAnswered / multipleCorrectQuestions) * 100)}%`,
      ])
    }

    if (numericalQuestions > 0) {
      questionTypeData.push([
        "Numerical",
        numericalQuestions.toString(),
        numericalAnswered.toString(),
        `${Math.round((numericalAnswered / numericalQuestions) * 100)}%`,
      ])
    }

    doc.autoTable({
      startY: 20,
      head: [["Question Type", "Total", "Answered", "Completion Rate"]],
      body: questionTypeData,
      theme: theme === "dark" ? "grid" : "striped",
      headStyles: {
        fillColor: accentColor,
        textColor: "#ffffff",
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: theme === "dark" ? "#2a2a2a" : "#f8f9fa",
      },
    })

    // Add detailed question analysis
    doc.setFillColor(accentColor)
    doc.rect(0, doc.autoTable.previous.finalY + 10, doc.internal.pageSize.width, 10, "F")
    doc.setTextColor("#ffffff")
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Detailed Question Analysis", 105, doc.autoTable.previous.finalY + 17, { align: "center" })

    // Prepare data for the detailed question table
    const questionData = questions.map((q, index) => {
      const isAnswered = q.userAnswer !== null && (!Array.isArray(q.userAnswer) || q.userAnswer.length > 0)
      let status = "Not Answered"

      if (isAnswered && q.isMarkedForReview) {
        status = "Answered & Marked for Review"
      } else if (isAnswered) {
        status = "Answered"
      } else if (q.isMarkedForReview) {
        status = "Marked for Review"
      }

      const answer =
        q.userAnswer === null
          ? "Not answered"
          : Array.isArray(q.userAnswer)
            ? q.userAnswer.join(", ")
            : q.userAnswer.toString()

      return [
        (index + 1).toString(),
        q.type,
        status,
        answer,
        formatTime(q.timeSpent),
        q.visitCount.toString(),
        q.isMarkedForReview ? "Yes" : "No",
      ]
    })

    doc.autoTable({
      startY: doc.autoTable.previous.finalY + 25,
      head: [["Q#", "Type", "Status", "Answer", "Time Spent", "Visits", "Reviewed"]],
      body: questionData,
      theme: theme === "dark" ? "grid" : "striped",
      headStyles: {
        fillColor: accentColor,
        textColor: "#ffffff",
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: theme === "dark" ? "#2a2a2a" : "#f8f9fa",
      },
      styles: {
        fontSize: 10,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 15 },
        3: { cellWidth: 30 },
      },
    })

    // Add footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.setTextColor(textColor)
      doc.text(
        `JEE CBT Practice - Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" },
      )
    }

    // Save the PDF
    doc.save("jee-cbt-practice-results.pdf")
  } catch (error) {
    console.error("Error generating PDF:", error)
    alert("There was an error generating the PDF. Please try again.")
  }
}

export interface AnswerKey {
  [questionId: number]: {
    type: string
    correctAnswer: string | string[]
    marks?: {
      correct: number
      incorrect: number
      unanswered: number
    }
  }
}

export interface MarkingScheme {
  singleCorrect: {
    global: boolean // Whether to use global marking scheme for all single correct questions
    default: {
      correct: number
      incorrect: number
      unanswered: number
    }
  }
  multipleCorrect: {
    allCorrect: number // +4 if all correct options are chosen
    partialCorrect: {
      allCorrectOptionsThreeMarked: number // +3 if all four options are correct but only three options are chosen
      twoCorrectOptionsMarked: number // +2 if three or more options are correct but only two options are chosen
      oneCorrectOptionMarked: number // +1 if two or more options are correct but only one option is chosen
    }
    anyIncorrect: number // -2 in all other cases
    unanswered: number // 0 if unanswered
  }
  numerical: {
    correct: number
    incorrect: number
    unanswered: number
  }
}

export interface Question {
  id: number
  type: string
  userAnswer: string | string[] | null
}

export interface ScoreResult {
  totalScore: number
  totalMaxScore: number
  sectionScores: {
    singleCorrect: {
      score: number
      maxScore: number
      correct: number
      incorrect: number
      unanswered: number
    }
    multipleCorrect: {
      score: number
      maxScore: number
      allCorrect: number
      partialCorrect: {
        allCorrectOptionsThreeMarked: number
        twoCorrectOptionsMarked: number
        oneCorrectOptionMarked: number
      }
      anyIncorrect: number
      unanswered: number
    }
    numerical: {
      score: number
      maxScore: number
      correct: number
      incorrect: number
      unanswered: number
    }
  }
  questionScores: {
    [questionId: number]: {
      score: number
      maxScore: number
      isCorrect: boolean
      correctAnswer: string | string[]
      userAnswer: string | string[] | null
    }
  }
}

export function calculateScore(questions: Question[], answerKey: AnswerKey, markingScheme: MarkingScheme): ScoreResult {
  const result: ScoreResult = {
    totalScore: 0,
    totalMaxScore: 0,
    sectionScores: {
      singleCorrect: {
        score: 0,
        maxScore: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
      },
      multipleCorrect: {
        score: 0,
        maxScore: 0,
        allCorrect: 0,
        partialCorrect: {
          allCorrectOptionsThreeMarked: 0,
          twoCorrectOptionsMarked: 0,
          oneCorrectOptionMarked: 0,
        },
        anyIncorrect: 0,
        unanswered: 0,
      },
      numerical: {
        score: 0,
        maxScore: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
      },
    },
    questionScores: {},
  }

  questions.forEach((question) => {
    const key = answerKey[question.id]
    if (!key) return // Skip if no answer key for this question

    let score = 0
    let maxScore = 0
    let isCorrect = false

    switch (question.type) {
      case "singleCorrect":
        // Use question-specific marking scheme if available and global is false
        const singleCorrectMarks =
          !markingScheme.singleCorrect.global && key.marks ? key.marks : markingScheme.singleCorrect.default

        maxScore = singleCorrectMarks.correct
        result.sectionScores.singleCorrect.maxScore += maxScore

        if (question.userAnswer === null) {
          score = singleCorrectMarks.unanswered
          result.sectionScores.singleCorrect.unanswered++
        } else if (question.userAnswer === key.correctAnswer) {
          score = singleCorrectMarks.correct
          isCorrect = true
          result.sectionScores.singleCorrect.correct++
        } else {
          score = singleCorrectMarks.incorrect
          result.sectionScores.singleCorrect.incorrect++
        }
        result.sectionScores.singleCorrect.score += score
        break

      case "multipleCorrect":
        maxScore = markingScheme.multipleCorrect.allCorrect
        result.sectionScores.multipleCorrect.maxScore += maxScore

        if (question.userAnswer === null || (Array.isArray(question.userAnswer) && question.userAnswer.length === 0)) {
          // Unanswered
          score = markingScheme.multipleCorrect.unanswered
          result.sectionScores.multipleCorrect.unanswered++
        } else if (Array.isArray(question.userAnswer) && Array.isArray(key.correctAnswer)) {
          // Check if any incorrect option is selected
          const hasIncorrectOption = question.userAnswer.some((option) => !key.correctAnswer.includes(option))

          if (hasIncorrectOption) {
            // Any incorrect option selected
            score = markingScheme.multipleCorrect.anyIncorrect
            result.sectionScores.multipleCorrect.anyIncorrect++
          } else {
            // All selected options are correct, now check for partial marking
            const correctOptionsCount = key.correctAnswer.length
            const markedCorrectOptionsCount = question.userAnswer.length

            if (markedCorrectOptionsCount === correctOptionsCount) {
              // All correct options are marked
              score = markingScheme.multipleCorrect.allCorrect
              isCorrect = true
              result.sectionScores.multipleCorrect.allCorrect++
            } else if (correctOptionsCount === 4 && markedCorrectOptionsCount === 3) {
              // All four options are correct but only three options are chosen
              score = markingScheme.multipleCorrect.partialCorrect.allCorrectOptionsThreeMarked
              result.sectionScores.multipleCorrect.partialCorrect.allCorrectOptionsThreeMarked++
            } else if (correctOptionsCount >= 3 && markedCorrectOptionsCount === 2) {
              // Three or more options are correct but only two options are chosen
              score = markingScheme.multipleCorrect.partialCorrect.twoCorrectOptionsMarked
              result.sectionScores.multipleCorrect.partialCorrect.twoCorrectOptionsMarked++
            } else if (correctOptionsCount >= 2 && markedCorrectOptionsCount === 1) {
              // Two or more options are correct but only one option is chosen
              score = markingScheme.multipleCorrect.partialCorrect.oneCorrectOptionMarked
              result.sectionScores.multipleCorrect.partialCorrect.oneCorrectOptionMarked++
            } else {
              // Any other case with correct options but not matching the specific criteria
              score = markingScheme.multipleCorrect.anyIncorrect
              result.sectionScores.multipleCorrect.anyIncorrect++
            }
          }
        }
        result.sectionScores.multipleCorrect.score += score
        break

      case "numerical":
        maxScore = markingScheme.numerical.correct
        result.sectionScores.numerical.maxScore += maxScore

        if (question.userAnswer === null) {
          score = markingScheme.numerical.unanswered
          result.sectionScores.numerical.unanswered++
        } else if (question.userAnswer === key.correctAnswer) {
          score = markingScheme.numerical.correct
          isCorrect = true
          result.sectionScores.numerical.correct++
        } else {
          score = markingScheme.numerical.incorrect
          result.sectionScores.numerical.incorrect++
        }
        result.sectionScores.numerical.score += score
        break
    }

    result.questionScores[question.id] = {
      score,
      maxScore,
      isCorrect,
      correctAnswer: key.correctAnswer,
      userAnswer: question.userAnswer,
    }

    result.totalScore += score
    result.totalMaxScore += maxScore
  })

  return result
}

export function validateAnswerKey(answerKey: any): boolean {
  if (!answerKey || typeof answerKey !== "object") return false

  // Check if it has at least one question
  if (Object.keys(answerKey).length === 0) return false

  // Check each question
  for (const [id, question] of Object.entries(answerKey)) {
    // Check if id is a number
    if (isNaN(Number(id))) return false

    // Check if question is an object
    if (!question || typeof question !== "object") return false

    // Check if question has type and correctAnswer
    if (!("type" in question) || !("correctAnswer" in question)) return false

    // Check if type is valid
    const type = (question as any).type
    if (type !== "singleCorrect" && type !== "multipleCorrect" && type !== "numerical") return false

    // Check if correctAnswer is valid based on type
    const correctAnswer = (question as any).correctAnswer
    if (type === "singleCorrect" && typeof correctAnswer !== "string") return false
    if (type === "multipleCorrect" && (!Array.isArray(correctAnswer) || correctAnswer.length === 0)) return false
    if (type === "numerical" && typeof correctAnswer !== "string") return false

    // Check marks if present
    const marks = (question as any).marks
    if (marks) {
      if (typeof marks !== "object") return false
      if (!("correct" in marks) || !("incorrect" in marks) || !("unanswered" in marks)) return false
      if (
        typeof marks.correct !== "number" ||
        typeof marks.incorrect !== "number" ||
        typeof marks.unanswered !== "number"
      )
        return false
    }
  }

  return true
}

export const defaultMarkingScheme: MarkingScheme = {
  singleCorrect: {
    global: true,
    default: {
      correct: 4,
      incorrect: -1,
      unanswered: 0,
    },
  },
  multipleCorrect: {
    allCorrect: 4,
    partialCorrect: {
      allCorrectOptionsThreeMarked: 3,
      twoCorrectOptionsMarked: 2,
      oneCorrectOptionMarked: 1,
    },
    anyIncorrect: -2,
    unanswered: 0,
  },
  numerical: {
    correct: 4,
    incorrect: 0,
    unanswered: 0,
  },
}

export const sampleAnswerKey: AnswerKey = {
  1: {
    type: "singleCorrect",
    correctAnswer: "A",
    marks: {
      correct: 4,
      incorrect: -1,
      unanswered: 0,
    },
  },
  2: {
    type: "singleCorrect",
    correctAnswer: "B",
  },
  3: {
    type: "multipleCorrect",
    correctAnswer: ["A", "C", "D"],
  },
  4: {
    type: "multipleCorrect",
    correctAnswer: ["B", "D"],
  },
  5: {
    type: "numerical",
    correctAnswer: "9.8",
  },
}

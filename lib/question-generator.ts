type QuestionType = "singleCorrect" | "multipleCorrect" | "numerical"

interface Question {
  id: number
  type: QuestionType
  text: string
  options?: string[]
  userAnswer: string | string[] | null
  isMarkedForReview: boolean
  isVisited: boolean
}

interface TestConfig {
  numQuestions: number
  questionTypes: {
    singleCorrect: boolean
    multipleCorrect: boolean
    numerical: boolean
  }
}

// Sample question templates
const questionTemplates = {
  singleCorrect: [
    "What is the value of acceleration due to gravity on Earth?",
    "Which of the following is a noble gas?",
    "Which of the following is an example of a scalar quantity?",
    "Which of the following is the correct formula for the kinetic energy of an object?",
    "Which of the following is a primary color of light?",
    "Which of the following is a unit of pressure?",
    "Which of the following is a property of electromagnetic waves?",
    "Which of the following is a property of acids?",
    "Which of the following is a transition element?",
    "Which of the following is a property of alkali metals?",
  ],
  multipleCorrect: [
    "Which of the following are vector quantities?",
    "Which of the following elements are metalloids?",
    "Which of the following are alkali metals?",
    "Which of the following are properties of ionic compounds?",
    "Which of the following are properties of covalent compounds?",
    "Which of the following are properties of metals?",
    "Which of the following are properties of non-metals?",
    "Which of the following are properties of acids?",
    "Which of the following are properties of bases?",
    "Which of the following are properties of electromagnetic waves?",
  ],
  numerical: [
    "Calculate the force (in N) required to accelerate a 2 kg object at 5 m/s².",
    "Calculate the kinetic energy (in J) of a 3 kg object moving at 4 m/s.",
    "Calculate the potential energy (in J) of a 2 kg object at a height of 10 m. (g = 9.8 m/s²)",
    "Calculate the work done (in J) when a force of 5 N moves an object by 3 m in the direction of the force.",
    "Calculate the pressure (in Pa) exerted by a force of 20 N acting on an area of 4 m².",
    "Calculate the density (in kg/m³) of an object with mass 6 kg and volume 2 m³.",
    "Calculate the momentum (in kg·m/s) of a 4 kg object moving at 5 m/s.",
    "Calculate the wavelength (in m) of a wave with frequency 5 Hz and speed 10 m/s.",
    "Calculate the resistance (in Ω) of a conductor with a potential difference of 12 V and current 3 A.",
    "Calculate the power (in W) of a device that does 60 J of work in 10 s.",
  ],
}

// Sample options for single correct questions
const singleCorrectOptions = [
  ["9.8 m/s²", "8.9 m/s²", "10.2 m/s²", "7.8 m/s²"],
  ["Helium", "Oxygen", "Nitrogen", "Carbon Dioxide"],
  ["Mass", "Velocity", "Acceleration", "Force"],
  ["KE = ½mv²", "KE = mgh", "KE = mv", "KE = m²v"],
  ["Red", "Brown", "Black", "Purple"],
  ["Pascal", "Joule", "Watt", "Ampere"],
  [
    "They require a medium for propagation",
    "They can travel through vacuum",
    "They have mass",
    "They are affected by gravity",
  ],
  [
    "They turn blue litmus red",
    "They turn red litmus blue",
    "They are always solid at room temperature",
    "They always have a pH greater than 7",
  ],
  ["Sodium", "Calcium", "Iron", "Potassium"],
  [
    "They are good conductors of heat",
    "They are poor conductors of electricity",
    "They have high melting points",
    "They react vigorously with water",
  ],
]

// Sample options for multiple correct questions
const multipleCorrectOptions = [
  ["Velocity", "Speed", "Displacement", "Mass", "Temperature"],
  ["Silicon", "Boron", "Sodium", "Germanium", "Aluminum"],
  ["Lithium", "Sodium", "Potassium", "Calcium", "Magnesium"],
  ["High melting point", "Soluble in water", "Conduct electricity when molten", "Low boiling point", "Brittle"],
  ["Low melting point", "Insoluble in water", "Poor conductors of electricity", "Soft", "Volatile"],
  ["Good conductors of heat", "Good conductors of electricity", "Malleable", "Ductile", "High melting point"],
  ["Poor conductors of heat", "Poor conductors of electricity", "Brittle", "Low melting point", "Form acidic oxides"],
  [
    "Turn blue litmus red",
    "Have pH less than 7",
    "React with bases to form salt and water",
    "Taste sour",
    "Conduct electricity in aqueous solution",
  ],
  [
    "Turn red litmus blue",
    "Have pH greater than 7",
    "React with acids to form salt and water",
    "Taste bitter",
    "Feel slippery",
  ],
  ["Travel in straight lines", "Can be reflected", "Can be refracted", "Can be polarized", "Can be diffracted"],
]

export function generateQuestions(config: TestConfig): Question[] {
  const questions: Question[] = []
  const availableTypes: QuestionType[] = []

  if (config.questionTypes.singleCorrect) availableTypes.push("singleCorrect")
  if (config.questionTypes.multipleCorrect) availableTypes.push("multipleCorrect")
  if (config.questionTypes.numerical) availableTypes.push("numerical")

  for (let i = 0; i < config.numQuestions; i++) {
    const typeIndex = i % availableTypes.length
    const type = availableTypes[typeIndex]

    const question: Question = {
      id: i + 1,
      type,
      text: "",
      userAnswer: null,
      isMarkedForReview: false,
      isVisited: false,
    }

    // Set question text and options based on type
    if (type === "singleCorrect") {
      const index = i % questionTemplates.singleCorrect.length
      question.text = questionTemplates.singleCorrect[index]
      question.options = singleCorrectOptions[index]
    } else if (type === "multipleCorrect") {
      const index = i % questionTemplates.multipleCorrect.length
      question.text = questionTemplates.multipleCorrect[index]
      question.options = multipleCorrectOptions[index]
      question.userAnswer = []
    } else if (type === "numerical") {
      const index = i % questionTemplates.numerical.length
      question.text = questionTemplates.numerical[index]
    }

    questions.push(question)
  }

  return questions
}

"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function TestLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if test configuration exists in localStorage
    const testConfig = localStorage.getItem("testConfig")

    if (!testConfig) {
      // Redirect to configure page if no test configuration exists
      router.push("/configure")
    } else {
      try {
        // Validate that the config is proper JSON
        JSON.parse(testConfig)
        setIsLoading(false)
      } catch (error) {
        console.error("Invalid test configuration:", error)
        router.push("/configure")
      }
    }
  }, [router])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Validating test configuration...</div>
  }

  return <>{children}</>
}

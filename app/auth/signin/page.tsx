"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FcGoogle } from "react-icons/fc"

export default function SignInPage() {
  const { signInWithGoogle, user } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // If user is already signed in, redirect to home
  if (user) {
    router.push("/")
    return null
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await signInWithGoogle()
    } catch (error) {
      console.error("Error signing in with Google:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign in to JEE CBT Practice</CardTitle>
          <CardDescription className="text-center">
            Sign in to save your test progress and view your performance history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <FcGoogle className="h-5 w-5" />
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
          <div className="text-sm text-center">
            <Link href="/" className="text-primary hover:underline">
              Continue without signing in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

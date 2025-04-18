import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight">JEE CBT Practice</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Practice JEE exams in a simulated Computer-Based Test environment
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Start Practice Test</CardTitle>
          <CardDescription>Configure your test settings and begin practice</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/configure" className="w-full">
            <Button size="lg" className="w-full">
              Configure Test
            </Button>
          </Link>
        </CardContent>
        <CardFooter className="flex flex-col text-sm text-muted-foreground">
          <p>Simulate the actual JEE exam environment</p>
          <p>Practice with different question types</p>
          <p>Get detailed analysis of your performance</p>
          <p>Download a PDF copy of your responses</p>
        </CardFooter>
      </Card>
    </div>
  )
}

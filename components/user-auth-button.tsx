"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { LogIn, LogOut, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function UserAuthButton() {
  const { user, signIn, signOut, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Loading...
      </Button>
    )
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={signIn} className="flex items-center gap-2">
        <LogIn className="h-4 w-4" />
        Sign In
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata.avatar_url || ""} alt={user.user_metadata.full_name || "User"} />
            <AvatarFallback>{user.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>{user.user_metadata.full_name || user.email}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 text-red-600">
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
